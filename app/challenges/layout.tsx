import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Food Challenges and Rewards",
  description:
    "Discover live restaurant challenges, collect letters through eligible orders and explore rewards with Tho'am.",
  alternates: {
    canonical: "/challenges",
  },
  openGraph: {
    title: "Food Challenges and Rewards | Tho'am",
    description:
      "Explore restaurant challenges and rewards from the Tho'am food community.",
    url: "/challenges",
    type: "website",
  },
};

export default function ChallengesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
