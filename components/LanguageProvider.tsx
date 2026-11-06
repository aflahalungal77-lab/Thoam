"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

export type Language = "en" | "ml";

const translations: Record<string, { en: string; ml: string }> = {
  "Home": { en: "Home", ml: "ഹോം" },
  "Restaurants": { en: "Restaurants", ml: "റെസ്റ്റോറന്റുകൾ" },
  "For restaurants": { en: "For restaurants", ml: "റെസ്റ്റോറന്റുകൾക്കായി" },
  "Log in": { en: "Log in", ml: "ലോഗിൻ" },
  "Log out": { en: "Log out", ml: "ലോഗ് ഔട്ട്" },
  "Order food": { en: "Order food", ml: "ഭക്ഷണം ഓർഡർ ചെയ്യുക" },
  "Challenges": { en: "Challenges", ml: "ചലഞ്ചുകൾ" },
  "My Orders": { en: "My Orders", ml: "എന്റെ ഓർഡറുകൾ" },
  "GOOD FOOD. RIGHT AROUND YOU.": { en: "GOOD FOOD. RIGHT AROUND YOU.", ml: "നല്ല ഭക്ഷണം. നിങ്ങൾക്ക് സമീപം." },
  "Your next": { en: "Your next", ml: "നിങ്ങളുടെ അടുത്ത" },
  "favourite bite.": { en: "favourite bite.", ml: "പ്രിയപ്പെട്ട രുചി." },
  "Discover local restaurants, explore delicious food and order your favourites with Tho’am.": { en: "Discover local restaurants, explore delicious food and order your favourites with Tho’am.", ml: "നാട്ടിലെ റെസ്റ്റോറന്റുകൾ കണ്ടെത്തൂ, രുചികരമായ വിഭവങ്ങൾ പരിചയപ്പെടൂ, ഇഷ്ടപ്പെട്ട ഭക്ഷണം Tho’am വഴി ഓർഡർ ചെയ്യൂ." },
  "Search biryani, burgers, restaurants...": { en: "Search biryani, burgers, restaurants...", ml: "ബിരിയാണി, ബർഗർ, റെസ്റ്റോറന്റുകൾ തിരയൂ..." },
  "Explore food": { en: "Explore food", ml: "ഭക്ഷണം കണ്ടെത്തൂ" },
  "Become a partner": { en: "Become a partner", ml: "പാർട്ണറാകൂ" },
  "Local restaurants": { en: "Local restaurants", ml: "പ്രാദേശിക റെസ്റ്റോറന്റുകൾ" },
  "Cash on delivery": { en: "Cash on delivery", ml: "ക്യാഷ് ഓൺ ഡെലിവറി" },
  "QR table ordering": { en: "QR table ordering", ml: "QR ടേബിൾ ഓർഡറിംഗ്" },
  "EXPLORE THE MENU": { en: "EXPLORE THE MENU", ml: "മെനു പരിചയപ്പെടാം" },
  "What are you craving?": { en: "What are you craving?", ml: "ഇന്ന് എന്താണ് കഴിക്കാൻ തോന്നുന്നത്?" },
  "All restaurants": { en: "All restaurants", ml: "എല്ലാ റെസ്റ്റോറന്റുകളും" },
  "All": { en: "All", ml: "എല്ലാം" },
  "Biryani": { en: "Biryani", ml: "ബിരിയാണി" },
  "Meals": { en: "Meals", ml: "ഊണ്" },
  "Fast Food": { en: "Fast Food", ml: "ഫാസ്റ്റ് ഫുഡ്" },
  "Snacks": { en: "Snacks", ml: "സ്നാക്ക്സ്" },
  "Drinks": { en: "Drinks", ml: "പാനീയങ്ങൾ" },
  "MADE BY LOCAL KITCHENS": { en: "MADE BY LOCAL KITCHENS", ml: "നാട്ടിലെ അടുക്കളകളിൽ നിന്ന്" },
  "Worth every bite.": { en: "Worth every bite.", ml: "ഓരോ കടിയും രുചികരം." },
  "Discover dishes from restaurants around you.": { en: "Discover dishes from restaurants around you.", ml: "നിങ്ങൾക്ക് സമീപമുള്ള റെസ്റ്റോറന്റുകളിലെ വിഭവങ്ങൾ കണ്ടെത്തൂ." },
  "View menu": { en: "View menu", ml: "മെനു കാണുക" },
  "Discovering delicious food...": { en: "Discovering delicious food...", ml: "രുചികരമായ ഭക്ഷണം കണ്ടെത്തുന്നു..." },
  "Vegetarian": { en: "Vegetarian", ml: "വെജിറ്റേറിയൻ" },
  "Non-vegetarian": { en: "Non-vegetarian", ml: "നോൺ വെജിറ്റേറിയൻ" },
  "Freshly prepared": { en: "Freshly prepared", ml: "പുതുതായി തയ്യാറാക്കിയത്" },
  "Explore restaurant": { en: "Explore restaurant", ml: "റെസ്റ്റോറന്റ് കാണുക" },
  "No matching dishes": { en: "No matching dishes", ml: "പൊരുത്തപ്പെടുന്ന വിഭവങ്ങളില്ല" },
  "Good food is on its way.": { en: "Good food is on its way.", ml: "രുചികരമായ വിഭവങ്ങൾ ഉടൻ ലഭ്യമാകും." },
  "Try another search or choose a different category.": { en: "Try another search or choose a different category.", ml: "മറ്റൊരു തിരച്ചിൽ നടത്തുക അല്ലെങ്കിൽ മറ്റൊരു വിഭാഗം തിരഞ്ഞെടുക്കുക." },
  "Explore our restaurant directory to discover available menus.": { en: "Explore our restaurant directory to discover available menus.", ml: "ലഭ്യമായ മെനുകൾ കാണാൻ റെസ്റ്റോറന്റ് ലിസ്റ്റ് പരിശോധിക്കുക." },
  "Clear filters": { en: "Clear filters", ml: "ഫിൽട്ടറുകൾ നീക്കുക" },
  "Explore restaurants": { en: "Explore restaurants", ml: "റെസ്റ്റോറന്റുകൾ കണ്ടെത്തൂ" },
  "Choose language": { en: "Choose language", ml: "ഭാഷ തിരഞ്ഞെടുക്കുക" },
  "Something delicious.": { en: "Something delicious.", ml: "രുചികരമായ വിഭവങ്ങൾ." },
  "Just around the corner.": { en: "Just around the corner.", ml: "നിങ്ങളുടെ തൊട്ടടുത്ത്." },
  "Dining in?": { en: "Dining in?", ml: "റെസ്റ്റോറന്റിൽ ഇരുന്ന് കഴിക്കുകയാണോ?" },
  "Scan. Order. Enjoy.": { en: "Scan. Order. Enjoy.", ml: "സ്കാൻ ചെയ്യൂ. ഓർഡർ ചെയ്യൂ. ആസ്വദിക്കൂ." },
  "Search food": { en: "Search food", ml: "ഭക്ഷണം തിരയുക" },
  "YOUR LOCAL FOOD GUIDE": { en: "YOUR LOCAL FOOD GUIDE", ml: "നിങ്ങളുടെ നാട്ടിലെ ഭക്ഷണ ഗൈഡ്" },
  "Good food.": { en: "Good food.", ml: "നല്ല ഭക്ഷണം." },
  "Close to you.": { en: "Close to you.", ml: "നിങ്ങളുടെ അടുത്ത്." },
  "Discover local favourites around you": { en: "Discover local favourites around you", ml: "നിങ്ങളുടെ സമീപത്തെ പ്രിയപ്പെട്ട ഭക്ഷണശാലകൾ കണ്ടെത്തൂ" },
  "Finding your location...": { en: "Finding your location...", ml: "നിങ്ങളുടെ സ്ഥാനം കണ്ടെത്തുന്നു..." },
  "Location enabled · Nearby first": { en: "Location enabled · Nearby first", ml: "ലൊക്കേഷൻ ഓണായി · അടുത്തുള്ളവ ആദ്യം" },
  "Use my location": { en: "Use my location", ml: "എന്റെ ലൊക്കേഷൻ ഉപയോഗിക്കുക" },
  "Location permission was denied. Enable it in browser settings, or browse all restaurants.": { en: "Location permission was denied. Enable it in browser settings, or browse all restaurants.", ml: "ലൊക്കേഷൻ അനുമതി ലഭിച്ചില്ല. ബ്രൗസർ സെറ്റിംഗ്സിൽ അനുവദിക്കാം, അല്ലെങ്കിൽ എല്ലാ റെസ്റ്റോറന്റുകളും കാണാം." },
  "Location is not supported by this browser. You can still browse all restaurants.": { en: "Location is not supported by this browser. You can still browse all restaurants.", ml: "ഈ ബ്രൗസറിൽ ലൊക്കേഷൻ ലഭ്യമല്ല. നിങ്ങൾക്ക് എല്ലാ റെസ്റ്റോറന്റുകളും കാണാം." },
  "Restaurants near you": { en: "Restaurants near you", ml: "നിങ്ങളുടെ അടുത്തുള്ള റെസ്റ്റോറന്റുകൾ" },
  "Find a place, browse the options, and discover your next meal.": { en: "Find a place, browse the options, and discover your next meal.", ml: "സ്ഥലം കണ്ടെത്തൂ, ഓപ്ഷനുകൾ പരിശോധിക്കൂ, അടുത്ത ഭക്ഷണം തിരഞ്ഞെടുക്കൂ." },
  "place": { en: "place", ml: "സ്ഥാപനം" },
  "places": { en: "places", ml: "സ്ഥാപനങ്ങൾ" },
  "Restaurant, food or location...": { en: "Restaurant, food or location...", ml: "റെസ്റ്റോറന്റ്, ഭക്ഷണം അല്ലെങ്കിൽ സ്ഥലം..." },
  "Search restaurants": { en: "Search restaurants", ml: "റെസ്റ്റോറന്റുകൾ തിരയുക" },
  "Area or city": { en: "Area or city", ml: "പ്രദേശം അല്ലെങ്കിൽ നഗരം" },
  "Filter by area or city": { en: "Filter by area or city", ml: "പ്രദേശം അല്ലെങ്കിൽ നഗരം അനുസരിച്ച് ഫിൽട്ടർ ചെയ്യുക" },
  "FILTER": { en: "FILTER", ml: "ഫിൽട്ടർ" },
  "Open now": { en: "Open now", ml: "ഇപ്പോൾ തുറന്നിരിക്കുന്നു" },
  "QR ordering": { en: "QR ordering", ml: "QR ഓർഡറിംഗ്" },
  "We couldn’t load restaurants": { en: "We couldn’t load restaurants", ml: "റെസ്റ്റോറന്റുകൾ ലോഡ് ചെയ്യാനായില്ല" },
  "Please check your connection and try again.": { en: "Please check your connection and try again.", ml: "ഇന്റർനെറ്റ് കണക്ഷൻ പരിശോധിച്ച് വീണ്ടും ശ്രമിക്കുക." },
  "Restaurants are getting ready": { en: "Restaurants are getting ready", ml: "റെസ്റ്റോറന്റുകൾ ഉടൻ ലഭ്യമാകും" },
  "No matching restaurants": { en: "No matching restaurants", ml: "പൊരുത്തപ്പെടുന്ന റെസ്റ്റോറന്റുകളില്ല" },
  "Open": { en: "Open", ml: "തുറന്നിരിക്കുന്നു" },
  "Closed": { en: "Closed", ml: "അടച്ചിരിക്കുന്നു" },
  "ARE YOU A RESTAURANT OWNER?": { en: "ARE YOU A RESTAURANT OWNER?", ml: "നിങ്ങൾ ഒരു റെസ്റ്റോറന്റ് ഉടമയാണോ?" },
  "Bring your restaurant online.": { en: "Bring your restaurant online.", ml: "നിങ്ങളുടെ റെസ്റ്റോറന്റിനെ ഓൺലൈനിലേക്ക് കൊണ്ടുവരൂ." },
  "Local food, connected.": { en: "Local food, connected.", ml: "നാട്ടിലെ ഭക്ഷണം, ഇനി ഒരൊറ്റ പ്ലാറ്റ്ഫോമിൽ." },
  "Preparing your menu...": { en: "Preparing your menu...", ml: "മെനു തയ്യാറാക്കുന്നു..." },
  "Restaurant unavailable": { en: "Restaurant unavailable", ml: "റെസ്റ്റോറന്റ് ലഭ്യമല്ല" },
  "Currently closed": { en: "Currently closed", ml: "ഇപ്പോൾ അടച്ചിരിക്കുന്നു" },
  "EXCLUSIVE DEALS": { en: "EXCLUSIVE DEALS", ml: "പ്രത്യേക ഓഫറുകൾ" },
  "Offers for you": { en: "Offers for you", ml: "നിങ്ങൾക്കായുള്ള ഓഫറുകൾ" },
  "Swipe to explore": { en: "Swipe to explore", ml: "കൂടുതൽ കാണാൻ സ്വൈപ്പ് ചെയ്യൂ" },
  "Menu timings follow India Standard Time (IST) and update automatically.": { en: "Menu timings follow India Standard Time (IST) and update automatically.", ml: "മെനു സമയം ഇന്ത്യൻ സ്റ്റാൻഡേർഡ് ടൈം (IST) അനുസരിച്ചാണ്; ഇത് സ്വയം അപ്ഡേറ്റ് ചെയ്യും." },
  "Explore the menu": { en: "Explore the menu", ml: "മെനു കാണാം" },
  "dish": { en: "dish", ml: "വിഭവം" },
  "dishes": { en: "dishes", ml: "വിഭവങ്ങൾ" },
  "Search biriyani, shawarma...": { en: "Search biriyani, shawarma...", ml: "ബിരിയാണി, ഷവർമ എന്നിവ തിരയൂ..." },
  "Search menu items": { en: "Search menu items", ml: "മെനുവിലെ വിഭവങ്ങൾ തിരയുക" },
  "Categories": { en: "Categories", ml: "വിഭാഗങ്ങൾ" },
  "Menu coming soon": { en: "Menu coming soon", ml: "മെനു ഉടൻ ലഭ്യമാകും" },
  "No dishes found": { en: "No dishes found", ml: "വിഭവങ്ങളൊന്നും കണ്ടെത്തിയില്ല" },
  "Try a different search or filter.": { en: "Try a different search or filter.", ml: "മറ്റൊരു തിരച്ചിലോ ഫിൽട്ടറോ പരീക്ഷിക്കുക." },
  "VEG": { en: "VEG", ml: "വെജിറ്റേറിയൻ" },
  "NON-VEG": { en: "NON-VEG", ml: "നോൺ വെജിറ്റേറിയൻ" },
  "Good food. Simple ordering.": { en: "Good food. Simple ordering.", ml: "നല്ല ഭക്ഷണം. എളുപ്പത്തിലുള്ള ഓർഡറിംഗ്." },
  "View your cart": { en: "View your cart", ml: "നിങ്ങളുടെ കാർട്ട് കാണുക" },
  "item": { en: "item", ml: "ഇനം" },
  "items": { en: "items", ml: "ഇനങ്ങൾ" },
  "YOUR SELECTION": { en: "YOUR SELECTION", ml: "നിങ്ങളുടെ തിരഞ്ഞെടുപ്പ്" },
  "Your cart": { en: "Your cart", ml: "നിങ്ങളുടെ കാർട്ട്" },
  "Your cart is empty": { en: "Your cart is empty", ml: "നിങ്ങളുടെ കാർട്ട് കാലിയാണ്" },
  "Subtotal": { en: "Subtotal", ml: "ഉപമൊത്തം" },
  "Total": { en: "Total", ml: "ആകെ" },
  "Preparing your checkout": { en: "Preparing your checkout", ml: "ചെക്ക്ഔട്ട് തയ്യാറാക്കുന്നു" },
  "Your restaurant and cart details are loading.": { en: "Your restaurant and cart details are loading.", ml: "റെസ്റ്റോറന്റിന്റെയും കാർട്ടിന്റെയും വിവരങ്ങൾ ലോഡ് ചെയ്യുന്നു." },
  "ORDER CONFIRMED": { en: "ORDER CONFIRMED", ml: "ഓർഡർ സ്ഥിരീകരിച്ചു" },
  "Thank you!": { en: "Thank you!", ml: "നന്ദി!" },
  "Your order has been placed successfully with": { en: "Your order has been placed successfully with", ml: "നിങ്ങളുടെ ഓർഡർ വിജയകരമായി സ്വീകരിച്ചു:" },
  "YOUR ORDER NUMBER": { en: "YOUR ORDER NUMBER", ml: "നിങ്ങളുടെ ഓർഡർ നമ്പർ" },
  "Cash on Delivery": { en: "Cash on Delivery", ml: "ക്യാഷ് ഓൺ ഡെലിവറി" },
  "Pay in cash when your order arrives.": { en: "Pay in cash when your order arrives.", ml: "ഓർഡർ ലഭിക്കുമ്പോൾ പണമായി അടയ്ക്കുക." },
  "View my orders": { en: "View my orders", ml: "എന്റെ ഓർഡറുകൾ കാണുക" },
  "Browse restaurants": { en: "Browse restaurants", ml: "റെസ്റ്റോറന്റുകൾ കാണുക" },
  "ALMOST THERE": { en: "ALMOST THERE", ml: "ഏകദേശം പൂർത്തിയായി" },
  "Checkout": { en: "Checkout", ml: "ചെക്ക്ഔട്ട്" },
  "Good food is just a few steps away.": { en: "Good food is just a few steps away.", ml: "നല്ല ഭക്ഷണം ഇനി ഏതാനും ചുവടുകൾ മാത്രം അകലെ." },
  "Delivery details": { en: "Delivery details", ml: "ഡെലിവറി വിവരങ്ങൾ" },
  "Where should we deliver your food?": { en: "Where should we deliver your food?", ml: "ഭക്ഷണം എവിടേക്കാണ് എത്തിക്കേണ്ടത്?" },
  "Enter your full name": { en: "Enter your full name", ml: "നിങ്ങളുടെ മുഴുവൻ പേര് നൽകുക" },
  "Your contact number": { en: "Your contact number", ml: "നിങ്ങളുടെ ഫോൺ നമ്പർ" },
  "House name, road, area, landmark and PIN code": { en: "House name, road, area, landmark and PIN code", ml: "വീട്ടുപേര്, റോഡ്, പ്രദേശം, ലാൻഡ്മാർക്ക്, പിൻകോഡ്" },
  "Delivery instructions": { en: "Delivery instructions", ml: "ഡെലിവറി നിർദ്ദേശങ്ങൾ" },
  "OPTIONAL": { en: "OPTIONAL", ml: "നിർബന്ധമില്ല" },
  "Any special instructions?": { en: "Any special instructions?", ml: "പ്രത്യേക നിർദ്ദേശങ്ങളുണ്ടോ?" },
  "Payment method": { en: "Payment method", ml: "പണമടയ്ക്കുന്ന രീതി" },
  "Simple, safe and convenient.": { en: "Simple, safe and convenient.", ml: "ലളിതവും സുരക്ഷിതവും സൗകര്യപ്രദവും." },
  "Pay when your food arrives.": { en: "Pay when your food arrives.", ml: "ഭക്ഷണം ലഭിക്കുമ്പോൾ പണമടയ്ക്കുക." },
  "No online payment required.": { en: "No online payment required.", ml: "ഓൺലൈൻ പേയ്മെന്റ് ആവശ്യമില്ല." },
  "YOUR ORDER": { en: "YOUR ORDER", ml: "നിങ്ങളുടെ ഓർഡർ" },
  "Order summary": { en: "Order summary", ml: "ഓർഡർ സംഗ്രഹം" },
  " on selected items": { en: " on selected items", ml: " തിരഞ്ഞെടുത്ത ഇനങ്ങൾക്ക്" },
  " on your order": { en: " on your order", ml: " നിങ്ങളുടെ ഓർഡറിന്" },
  "APPLIED": { en: "APPLIED", ml: "പ്രയോഗിച്ചു" },
  "Items subtotal": { en: "Items subtotal", ml: "ഇനങ്ങളുടെ ഉപമൊത്തം" },
  "Offer discount": { en: "Offer discount", ml: "ഓഫർ ഇളവ്" },
  "Delivery fee": { en: "Delivery fee", ml: "ഡെലിവറി ചാർജ്" },
  "Platform fee": { en: "Platform fee", ml: "പ്ലാറ്റ്ഫോം ഫീസ്" },
  "Total amount": { en: "Total amount", ml: "ആകെ തുക" },
  "Placing order...": { en: "Placing order...", ml: "ഓർഡർ നൽകുന്നു..." },
  "Place COD order": { en: "Place COD order", ml: "COD ഓർഡർ നൽകുക" },
  "Final discount and total verified by the server.": { en: "Final discount and total verified by the server.", ml: "അവസാന ഇളവും തുകയും സെർവർ പരിശോധിച്ച് ഉറപ്പാക്കുന്നു." },
  "Check your address": { en: "Check your address", ml: "നിങ്ങളുടെ വിലാസം പരിശോധിക്കുക" },
  "Include your area and nearby landmark.": { en: "Include your area and nearby landmark.", ml: "നിങ്ങളുടെ പ്രദേശവും സമീപത്തെ ലാൻഡ്മാർക്കും ഉൾപ്പെടുത്തുക." },
  "Good food. Made simple.": { en: "Good food. Made simple.", ml: "നല്ല ഭക്ഷണം. ഇനി എളുപ്പത്തിൽ." },
  "Loading checkout...": { en: "Loading checkout...", ml: "ചെക്ക്ഔട്ട് ലോഡ് ചെയ്യുന്നു..." },
  "Your name": { en: "Your name", ml: "നിങ്ങളുടെ പേര്" },
  "At least 6 characters": { en: "At least 6 characters", ml: "കുറഞ്ഞത് 6 അക്ഷരങ്ങൾ" },
  "Create account": { en: "Create account", ml: "അക്കൗണ്ട് സൃഷ്ടിക്കുക" },
  "Sign in": { en: "Sign in", ml: "സൈൻ ഇൻ" },
  "Loading sign in…": { en: "Loading sign in…", ml: "സൈൻ ഇൻ ലോഡ് ചെയ്യുന്നു…" },
  "YOUR THO'AM ACCOUNT": { en: "YOUR THO'AM ACCOUNT", ml: "നിങ്ങളുടെ THO'AM അക്കൗണ്ട്" },
  "My orders": { en: "My orders", ml: "എന്റെ ഓർഡറുകൾ" },
  "Every order, every update — all in one place.": { en: "Every order, every update — all in one place.", ml: "ഓരോ ഓർഡറും ഓരോ അപ്ഡേറ്റും ഒരിടത്ത്." },
  "Refresh": { en: "Refresh", ml: "പുതുക്കുക" },
  "Order history": { en: "Order history", ml: "ഓർഡർ ചരിത്രം" },
  "Explore restaurants": { en: "Explore restaurants", ml: "റെസ്റ്റോറന്റുകൾ കണ്ടെത്തൂ" },
  "Try again": { en: "Try again", ml: "വീണ്ടും ശ്രമിക്കുക" },
  "RECENT ACTIVITY": { en: "RECENT ACTIVITY", ml: "സമീപകാല പ്രവർത്തനങ്ങൾ" },
  "Your orders": { en: "Your orders", ml: "നിങ്ങളുടെ ഓർഡറുകൾ" },
  "total": { en: "total", ml: "ആകെ" },
  "ORDER ID": { en: "ORDER ID", ml: "ഓർഡർ ഐഡി" },
  "Placed": { en: "Placed", ml: "നൽകിയത്" },
  "Track order": { en: "Track order", ml: "ഓർഡർ ട്രാക്ക് ചെയ്യുക" },
  "ORDER TRACKING": { en: "ORDER TRACKING", ml: "ഓർഡർ ട്രാക്കിംഗ്" },
  "Close tracking": { en: "Close tracking", ml: "ട്രാക്കിംഗ് അടയ്ക്കുക" },
  "Please contact the restaurant if you need more information.": { en: "Please contact the restaurant if you need more information.", ml: "കൂടുതൽ വിവരങ്ങൾക്ക് റെസ്റ്റോറന്റുമായി ബന്ധപ്പെടുക." },
  "Current status": { en: "Current status", ml: "നിലവിലെ സ്ഥിതി" },
  "Update time not recorded": { en: "Update time not recorded", ml: "അപ്ഡേറ്റ് സമയം രേഖപ്പെടുത്തിയിട്ടില്ല" },
  "Waiting for update": { en: "Waiting for update", ml: "അപ്ഡേറ്റിനായി കാത്തിരിക്കുന്നു" },
  "Order details": { en: "Order details", ml: "ഓർഡർ വിവരങ്ങൾ" },
  "Order placed": { en: "Order placed", ml: "ഓർഡർ നൽകി" },
  "Payment · Cash on delivery": { en: "Payment · Cash on delivery", ml: "പേയ്മെന്റ് · ക്യാഷ് ഓൺ ഡെലിവറി" },
  "Cash collected": { en: "Cash collected", ml: "പണം സ്വീകരിച്ചു" },
  "Refunded": { en: "Refunded", ml: "റീഫണ്ട് ചെയ്തു" },
  "Pay on arrival": { en: "Pay on arrival", ml: "ലഭിക്കുമ്പോൾ പണമടയ്ക്കുക" },
  "Delivery address": { en: "Delivery address", ml: "ഡെലിവറി വിലാസം" },
  "Items in this order": { en: "Items in this order", ml: "ഈ ഓർഡറിലെ ഇനങ്ങൾ" },
  "Order status refreshes automatically.": { en: "Order status refreshes automatically.", ml: "ഓർഡർ സ്റ്റാറ്റസ് സ്വയം പുതുക്കും." },
  "Refresh tracking": { en: "Refresh tracking", ml: "ട്രാക്കിംഗ് പുതുക്കുക" },
  "Done": { en: "Done", ml: "പൂർത്തിയായി" },
  "Preparing your menu": { en: "Preparing your menu", ml: "മെനു തയ്യാറാക്കുന്നു" },
  "Menu unavailable": { en: "Menu unavailable", ml: "മെനു ലഭ്യമല്ല" },
  "You're all set.": { en: "You're all set.", ml: "എല്ലാം തയ്യാറായി." },
  "Restaurant": { en: "Restaurant", ml: "റെസ്റ്റോറന്റ്" },
  "KOT number": { en: "KOT number", ml: "KOT നമ്പർ" },
  "Table": { en: "Table", ml: "മേശ" },
  "Payment": { en: "Payment", ml: "പേയ്മെന്റ്" },
  "Cash at restaurant": { en: "Cash at restaurant", ml: "റെസ്റ്റോറന്റിൽ പണം നൽകുക" },
  "Made for you.": { en: "Made for you.", ml: "നിങ്ങൾക്കായി." },
  "Need anything?": { en: "Need anything?", ml: "എന്തെങ്കിലും ആവശ്യമുണ്ടോ?" },
  "How can we help?": { en: "How can we help?", ml: "ഞങ്ങൾ എങ്ങനെ സഹായിക്കണം?" },
  "Tell us what you need...": { en: "Tell us what you need...", ml: "നിങ്ങൾക്ക് എന്താണ് വേണ്ടതെന്ന് പറയൂ..." },
  "Find something you’ll love.": { en: "Find something you’ll love.", ml: "നിങ്ങൾക്ക് ഇഷ്ടപ്പെടുന്ന വിഭവം കണ്ടെത്തൂ." },
  "ITEMS": { en: "ITEMS", ml: "ഇനങ്ങൾ" },
  "Search dishes...": { en: "Search dishes...", ml: "വിഭവങ്ങൾ തിരയുക..." },
  "The menu is being prepared.": { en: "The menu is being prepared.", ml: "മെനു തയ്യാറാക്കിക്കൊണ്ടിരിക്കുന്നു." },
  "Please check back in a little while.": { en: "Please check back in a little while.", ml: "അൽപ്പസമയത്തിന് ശേഷം വീണ്ടും പരിശോധിക്കുക." },
  "FRESH & DELICIOUS": { en: "FRESH & DELICIOUS", ml: "പുതുമയും രുചിയും" },
  "Your order": { en: "Your order", ml: "നിങ്ങളുടെ ഓർഡർ" },
  "KITCHEN NOTES": { en: "KITCHEN NOTES", ml: "അടുക്കളയ്ക്കുള്ള കുറിപ്പുകൾ" },
  "Add an instruction to any dish if needed. No personal details required.": { en: "Add an instruction to any dish if needed. No personal details required.", ml: "ആവശ്യമെങ്കിൽ വിഭവത്തിനുള്ള നിർദ്ദേശം ചേർക്കാം. വ്യക്തിഗത വിവരങ്ങൾ ആവശ്യമില്ല." },
  "Less spicy, no onions, etc. (optional)": { en: "Less spicy, no onions, etc. (optional)", ml: "എരിവ് കുറച്ച്, ഉള്ളി വേണ്ട തുടങ്ങിയവ (നിർബന്ധമില്ല)" },
  "Order note (optional)": { en: "Order note (optional)", ml: "ഓർഡർ കുറിപ്പ് (നിർബന്ധമില്ല)" },
  "Pay at the restaurant": { en: "Pay at the restaurant", ml: "റെസ്റ്റോറന്റിൽ പണമടയ്ക്കുക" },
  "Good food. Good moments.": { en: "Good food. Good moments.", ml: "നല്ല ഭക്ഷണം. നല്ല നിമിഷങ്ങൾ." },
  "View your order": { en: "View your order", ml: "നിങ്ങളുടെ ഓർഡർ കാണുക" },
};

type LanguageContextValue = {
  language: Language;
  setLanguage: (language: Language) => void;
  t: (text: string) => string;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>("en");

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem("thoam-language");
      if (saved === "en" || saved === "ml") setLanguageState(saved);
    } catch {
      // Keep English when browser storage is unavailable.
    }
  }, []);

  useEffect(() => {
    document.documentElement.lang = language === "ml" ? "ml" : "en";
  }, [language]);

  const setLanguage = useCallback((next: Language) => {
    setLanguageState(next);
    try {
      window.localStorage.setItem("thoam-language", next);
    } catch {
      // Language still changes for the current session.
    }
  }, []);

  const t = useCallback((text: string) => translations[text]?.[language] ?? text, [language]);
  const value = useMemo(() => ({ language, setLanguage, t }), [language, setLanguage, t]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error("useLanguage must be used inside LanguageProvider");
  return context;
}
