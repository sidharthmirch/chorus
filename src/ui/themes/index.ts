export type ThemeMode = "light" | "dark" | "system";

export type Theme = {
    name: string;
    label: string;
    colors: {
        light: Record<string, string>;
        dark: Record<string, string>;
    };
};

export const colorPalette = {
    accent: {
        25: "32 49% 95%",
        50: "32 59% 93%",
        100: "30 50% 90%",
        200: "30 51% 85%",
        300: "29 52% 82%",
        400: "30 51% 72%",
        500: "30 47% 63%",
        600: "30 34% 53%",
        700: "30 29% 43%",
        800: "29 30% 32%",
        900: "31 30% 21%",
    },
    gray: {
        0: "0 0% 100%",
        25: "60 17% 99%",
        50: "60 9% 98%",
        100: "60 5% 96%",
        200: "20 7% 92%",
        300: "30 8% 85%",
        400: "24 7% 73%",
        500: "28 6% 55%",
        600: "28 6% 40%",
        700: "33 6% 30%",
        800: "26 6% 23%",
        900: "12 7% 15%",
        950: "24 10% 10%",
    },
    transparent: {
        25: "60 31% 31%",
        50: "60 23% 28%",
        100: "60 71% 7%",
        200: "20 37% 16%",
        300: "30 79% 9%",
        400: "24 77% 8%",
        500: "27 82% 6%",
        600: "27 77% 5%",
        700: "32 76% 3%",
        800: "27 60% 3%",
        900: "10 60% 2%",
        950: "20 100% 1%",
    },
    special: "19 51% 70%",
} as const;

export const defaultTheme: Theme = {
    name: "default",
    label: "Default",
    colors: {
        light: {
            highlight: colorPalette.accent[25],
            "highlight-foreground": colorPalette.accent[800],
            accent: colorPalette.gray[100],
            "accent-foreground": colorPalette.gray[900],
            background: colorPalette.gray[0],
            border: colorPalette.gray[200],
            card: colorPalette.gray[0],
            "card-foreground": colorPalette.gray[950],
            destructive: "5 81% 56%",
            "destructive-foreground": "5 85% 95%",
            // REWORK-W1: status colors for quota meters etc., both themes (docs/rework/design/OVERVIEW.md)
            success: "124 28% 42%", // #4e8a52
            warning: "36 53% 45%", // #b07f36
            foreground: colorPalette.gray[900],
            input: colorPalette.gray[200],
            muted: colorPalette.gray[100],
            "muted-foreground": colorPalette.gray[500],
            popover: colorPalette.gray[0],
            "popover-foreground": colorPalette.gray[950],
            primary: colorPalette.accent[900],
            "primary-foreground": colorPalette.gray[25],
            ring: colorPalette.gray[900],
            secondary: colorPalette.gray[100],
            "secondary-foreground": colorPalette.gray[900],
            "sidebar-foreground": colorPalette.gray[700],
            "sidebar-background": colorPalette.gray[25],
            "sidebar-primary": colorPalette.gray[900],
            "sidebar-primary-foreground": colorPalette.gray[25],
            "sidebar-muted-foreground": colorPalette.gray[600],
            "sidebar-accent": colorPalette.gray[100],
            "sidebar-accent-foreground": colorPalette.gray[900],
            "sidebar-border": colorPalette.gray[200],
            "sidebar-ring": colorPalette.gray[400],
            "input-border": colorPalette.gray[300],
            helper: colorPalette.gray[400],
            radius: "0.5rem",
        },
        dark: {
            highlight: colorPalette.accent[800],
            "highlight-foreground": colorPalette.accent[25],
            accent: colorPalette.gray[900],
            "accent-foreground": colorPalette.gray[50],
            background: colorPalette.gray[950],
            border: colorPalette.gray[800],
            card: colorPalette.gray[950],
            "card-foreground": colorPalette.gray[50],
            destructive: "5 81% 56%",
            "destructive-foreground": "5 85% 95%",
            // REWORK-W1: status colors for quota meters etc., both themes (docs/rework/design/OVERVIEW.md)
            success: "120 22% 59%", // #7fae7f
            warning: "36 56% 59%", // #d1a35d
            foreground: colorPalette.gray[50],
            input: colorPalette.gray[800],
            muted: colorPalette.gray[900],
            "muted-foreground": colorPalette.gray[400],
            popover: colorPalette.gray[950],
            "popover-foreground": colorPalette.gray[50],
            primary: colorPalette.gray[50],
            "primary-foreground": colorPalette.gray[900],
            ring: colorPalette.gray[300],
            secondary: colorPalette.gray[800],
            "secondary-foreground": colorPalette.gray[50],
            "sidebar-muted-foreground": colorPalette.gray[300],
            "sidebar-foreground": colorPalette.gray[100],
            "sidebar-background": colorPalette.gray[900],
            "sidebar-primary": colorPalette.gray[100],
            "sidebar-primary-foreground": colorPalette.gray[0],
            "sidebar-accent": colorPalette.gray[800],
            "sidebar-accent-foreground": colorPalette.gray[100],
            "sidebar-border": colorPalette.gray[800],
            "sidebar-ring": colorPalette.gray[300],
            "input-border": colorPalette.gray[700],
            helper: colorPalette.gray[500],
            radius: "0.5rem",
        },
    },
};

export const themes = [defaultTheme] as const;

export type ThemeName = (typeof themes)[number]["name"];
