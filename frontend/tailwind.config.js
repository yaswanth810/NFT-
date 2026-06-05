/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        scai: {
          bg:       "#090b14",
          bg2:      "#0e1120",
          surface:  "rgba(255,255,255,0.04)",
          border:   "rgba(255,255,255,0.08)",
          primary:  "#7c6cfc",
          plit:     "#a695ff",
          accent:   "#22d3ee",
          success:  "#34d399",
          error:    "#f87171",
          warn:     "#fbbf24",
          muted:    "#64748b",
          label:    "#94a3b8",
          text:     "#e2e8f0",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      backgroundImage: {
        "hero-mesh":
          "radial-gradient(ellipse 80% 50% at 20% 10%, rgba(124,108,252,0.15) 0%, transparent 60%), radial-gradient(ellipse 60% 40% at 80% 80%, rgba(34,211,238,0.10) 0%, transparent 60%)",
        "card-gradient":
          "linear-gradient(135deg, rgba(124,108,252,0.08) 0%, rgba(34,211,238,0.04) 100%)",
        "primary-gradient":
          "linear-gradient(135deg, #7c6cfc 0%, #5b4fd4 100%)",
        "text-gradient":
          "linear-gradient(135deg, #fff 30%, #a695ff 70%, #22d3ee 100%)",
      },
      animation: {
        "fade-in":   "fadeIn 0.3s ease",
        "slide-up":  "slideUp 0.4s ease",
        "pulse-dot": "pulseDot 2s ease-in-out infinite",
        "spin-slow": "spin 2s linear infinite",
        shimmer:     "shimmer 1.5s infinite",
      },
      keyframes: {
        fadeIn:   { from: { opacity: 0 }, to: { opacity: 1 } },
        slideUp:  { from: { opacity: 0, transform: "translateY(20px)" }, to: { opacity: 1, transform: "translateY(0)" } },
        pulseDot: {
          "0%,100%": { opacity: 1, boxShadow: "0 0 0 0 rgba(52,211,153,0.5)" },
          "50%":     { opacity: 0.8, boxShadow: "0 0 0 6px rgba(52,211,153,0)" },
        },
        shimmer: {
          "0%":   { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
      },
      boxShadow: {
        "glow-primary": "0 0 24px rgba(124,108,252,0.4)",
        "glow-accent":  "0 0 24px rgba(34,211,238,0.3)",
        "card":         "0 4px 32px rgba(0,0,0,0.4)",
      },
      backdropBlur: { xs: "4px" },
    },
  },
  plugins: [],
};
