import type { TextStyle } from "react-native";

// Matches the desktop web shadcn Zinc + Blue design system (oklch palette).
export const colors = {
  background: "#FAFAFA", // --sidebar: oklch(0.985 0 0) / zinc-50 canvas
  surface: "#FFFFFF", // --card / --background: oklch(1 0 0)
  ink: "#09090B", // --foreground: oklch(0.141 0.005 285.823) / zinc-950
  muted: "#71717A", // --muted-foreground: oklch(0.552 0.016 285.938) / zinc-500
  green: "#1D4ED8", // --primary: oklch(0.488 0.243 264.376) / blue-700
  greenDark: "#1E40AF", // --chart-5: oklch(0.424 0.199 265.638) / blue-800
  greenSoft: "#EFF6FF", // --primary-foreground: oklch(0.97 0.014 254.604) / blue-50
  lime: "#DBEAFE", // blue-100 accent
  border: "#E4E4E7", // --border / --input: oklch(0.92 0.004 286.32) / zinc-200
  orange: "#D97706", // amber-600
  orangeSoft: "#FFFBEB", // amber-50
  red: "#DC2626", // --destructive: oklch(0.577 0.245 27.325) / red-600
  redSoft: "#FEF2F2", // red-50
  blue: "#2563EB", // --chart-3: oklch(0.546 0.245 262.881) / blue-600
  blueSoft: "#EFF6FF", // blue-50
  emerald: "#059669", // emerald-600 for eco/approved badges
  emeraldSoft: "#ECFDF5", // emerald-50
  white: "#FFFFFF",
  pressed: "#F4F4F5", // --secondary / --muted: oklch(0.967 0.001 286.375) / zinc-100
  placeholder: "#A1A1AA", // --ring: oklch(0.705 0.015 286.067) / zinc-400
  scrim: "#09090B80",
  track: "#F4F4F5", // --secondary: zinc-100
};
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 40,
};
export const radius = { sm: 10, md: 14, lg: 20, full: 999 };
export const layout = {
  contentWidth: 600,
  touch: 46,
  iconBox: 38,
  chartHeight: 10,
  photoHeight: 176,
};
export const typography = {
  display: {
    fontSize: 30,
    fontWeight: "700",
    letterSpacing: -0.8,
    lineHeight: 36,
    fontVariant: ["tabular-nums"],
  },
  amount: {
    fontSize: 36,
    fontWeight: "700",
    letterSpacing: -0.8,
    lineHeight: 44,
    fontVariant: ["tabular-nums"],
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    letterSpacing: -0.5,
    lineHeight: 30,
  },
  heading: {
    fontSize: 18,
    fontWeight: "600",
    letterSpacing: -0.3,
    lineHeight: 24,
  },
  body: { fontSize: 15, lineHeight: 22 },
  label: { fontSize: 14, fontWeight: "600", lineHeight: 20 },
  caption: { fontSize: 12, lineHeight: 17 },
  eyebrow: {
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.4,
    lineHeight: 15,
  },
} as const satisfies Record<string, TextStyle>;
export const categoryColors = [
  "#2563EB", // blue-600
  "#10B981", // emerald-500
  "#F59E0B", // amber-500
  "#8B5CF6", // violet-500
  "#EC4899", // pink-500
  "#06B6D4", // cyan-500
  "#F97316", // orange-500
  "#6366F1", // indigo-500
  "#14B8A6", // teal-500
  "#EF4444", // red-500
];
