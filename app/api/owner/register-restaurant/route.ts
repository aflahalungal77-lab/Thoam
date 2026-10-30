import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

function jsonError(message: string, status: number) {
  return NextResponse.json({ success: false, error: message }, { status });
}

export async function POST(request: Request) {
  let restaurantIdToCleanup: string | null = null;

  try {
    // 1. Verify the logged-in user's access token.
    const authorization = request.headers.get("authorization");

    if (!authorization?.startsWith("Bearer ")) {
      return jsonError("Login session missing. Please log in again.", 401);
    }

    const token = authorization.slice(7).trim();

    if (!token) {
      return jsonError("Login session missing. Please log in again.", 401);
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !anonKey || !serviceRoleKey) {
      console.error("Missing Supabase server environment variables.");

      return jsonError(
        "Server configuration error. Please contact Tho'am support.",
        500
      );
    }

    // Client used only to verify the user's token.
    const authClient = createClient(url, anonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });

    const {
      data: { user },
      error: authError,
    } = await authClient.auth.getUser(token);

    if (authError || !user) {
      return jsonError(
        "Your login session has expired. Please log in again.",
        401
      );
    }

    // Server-only privileged client. Never expose this key in browser code.
    const admin = createClient(url, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });

    // 2. Validate the submitted details.
    let body: Record<string, unknown>;

    try {
      body = await request.json();
    } catch {
      return jsonError("Invalid request body.", 400);
    }

    const ownerName = String(body.ownerName ?? "").trim();
    const restaurantName = String(body.restaurantName ?? "").trim();
    const slug = String(body.slug ?? "").trim().toLowerCase();
    const whatsappNumber = String(body.whatsappNumber ?? "").replace(/\D/g, "");
    const description = String(body.description ?? "").trim();

    if (!ownerName || !restaurantName || !slug || !whatsappNumber) {
      return jsonError("Please complete all required fields.", 400);
    }

    if (ownerName.length > 100 || restaurantName.length > 120) {
      return jsonError("Owner or restaurant name is too long.", 400);
    }

    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 80) {
      return jsonError("Enter a valid menu slug.", 400);
    }

    if (whatsappNumber.length < 10 || whatsappNumber.length > 15) {
      return jsonError(
        "Enter a valid WhatsApp number including country code.",
        400
      );
    }

    if (description.length > 1000) {
      return jsonError("Description must be 1000 characters or fewer.", 400);
    }

    // 3. Find the user's profile.
    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .select("id, role, restaurant_id")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      console.error("Profile lookup failed:", profileError.message);

      return jsonError("Could not load your profile.", 500);
    }

    // Never allow an admin account to be converted by owner registration.
    if (profile?.role === "admin") {
      return jsonError(
        "Admin accounts cannot register through restaurant onboarding.",
        403
      );
    }

    // Existing restaurant: do not create another one.
    if (profile?.restaurant_id) {
      return NextResponse.json({
        success: true,
        alreadyLinked: true,
        restaurantId: profile.restaurant_id,
      });
    }

    // Only customer accounts or owner accounts without a restaurant can proceed.
    if (
      profile &&
      profile.role !== "customer" &&
      profile.role !== "restaurant_owner"
    ) {
      return jsonError("This account cannot register a restaurant.", 403);
    }

    // 4. Create a missing profile or prepare an existing profile.
    if (!profile) {
      const { error: createProfileError } = await admin
        .from("profiles")
        .insert({
          id: user.id,
          role: "restaurant_owner",
          restaurant_id: null,
        });

      if (createProfileError) {
        // Another request may have created this profile concurrently.
        const { data: refreshedProfile, error: refreshError } = await admin
          .from("profiles")
          .select("id, role, restaurant_id")
          .eq("id", user.id)
          .maybeSingle();

        if (refreshError || !refreshedProfile) {
          console.error(
            "Profile creation failed:",
            createProfileError.message
          );

          return jsonError(
            "Could not prepare your profile. Please try again.",
            500
          );
        }

        if (refreshedProfile.role === "admin") {
          return jsonError("Admin accounts cannot use owner registration.", 403);
        }

        if (refreshedProfile.restaurant_id) {
          return NextResponse.json({
            success: true,
            alreadyLinked: true,
            restaurantId: refreshedProfile.restaurant_id,
          });
        }

        if (
          refreshedProfile.role !== "customer" &&
          refreshedProfile.role !== "restaurant_owner"
        ) {
          return jsonError("This account cannot register a restaurant.", 403);
        }
      }
    }

    // 5. Create the restaurant using the server-side client.
    const { data: restaurant, error: restaurantError } = await admin
      .from("restaurants")
      .insert({
        owner_id: user.id,
        name: restaurantName,
        slug,
        whatsapp_number: whatsappNumber,
        description: description || null,
        is_open: true,
        status: "pending",
      })
      .select("id")
      .single();

    if (restaurantError || !restaurant) {
      console.error(
        "Restaurant creation failed:",
        restaurantError?.code,
        restaurantError?.message
      );

      if (restaurantError?.code === "23505") {
        return jsonError(
          "This menu slug is already taken. Please choose another.",
          409
        );
      }

      return jsonError(
        "Could not create the restaurant. Check your restaurants table schema.",
        500
      );
    }

    restaurantIdToCleanup = restaurant.id;

    // 6. Link the restaurant to this user's profile.
    // The null check helps prevent overwriting an existing restaurant link.
    const { data: linkedProfile, error: linkError } = await admin
      .from("profiles")
      .update({
        role: "restaurant_owner",
        restaurant_id: restaurant.id,
      })
      .eq("id", user.id)
      .is("restaurant_id", null)
      .in("role", ["customer", "restaurant_owner"])
      .select("id")
      .maybeSingle();

    if (linkError || !linkedProfile) {
      console.error("Restaurant linking failed:", linkError?.message);

      // Best-effort cleanup of the unlinked restaurant.
      const { error: cleanupError } = await admin
        .from("restaurants")
        .delete()
        .eq("id", restaurant.id);

      if (cleanupError) {
        console.error("Restaurant cleanup failed:", cleanupError.message);
      } else {
        restaurantIdToCleanup = null;
      }

      // Another request may have completed the registration first.
      const { data: latestProfile } = await admin
        .from("profiles")
        .select("role, restaurant_id")
        .eq("id", user.id)
        .maybeSingle();

      if (
        latestProfile?.role === "restaurant_owner" &&
        latestProfile.restaurant_id
      ) {
        return NextResponse.json({
          success: true,
          alreadyLinked: true,
          restaurantId: latestProfile.restaurant_id,
        });
      }

      return jsonError(
        "Could not link your restaurant. Please try again.",
        409
      );
    }

    restaurantIdToCleanup = null;

    // 7. Save the owner's name in the profile and Auth metadata.
    const { error: profileNameError } = await admin
      .from("profiles")
      .update({ full_name: ownerName })
      .eq("id", user.id);

    if (profileNameError) {
      console.error("Owner profile name update failed:", profileNameError.message);
    }

    const { error: metadataError } = await admin.auth.admin.updateUserById(
      user.id,
      {
        user_metadata: {
          ...user.user_metadata,
          full_name: ownerName,
        },
      }
    );

    if (metadataError) {
      console.error("Owner metadata update failed:", metadataError.message);
    }

    // 8. Registration completed.
    return NextResponse.json({
      success: true,
      alreadyLinked: false,
      restaurantId: restaurant.id,
    });
  } catch (error) {
    console.error("Restaurant registration failed:", error);

    return jsonError("Unexpected server error. Check server logs.", 500);
  }
}