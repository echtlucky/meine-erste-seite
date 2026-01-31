# LCKY HUB - Color Palette (Purple/Neon Theme)

## Primary Colors (Brand)

| Name | HEX | RGB | Usage |
|------|-----|-----|-------|
| **Primary** | `#8B5CF6` | 139, 92, 246 | Main brand color, buttons, accents |
| **Primary Hover** | `#7C3AED` | 124, 58, 237 | Hover state, active elements |
| **Primary Light** | `#A78BFA` | 167, 139, 250 | Light accents, gradients |

## Neon Accents

| Name | HEX | RGB | Usage |
|------|-----|-----|-------|
| **Neon Cyan** | `#00FFFF` | 0, 255, 255 | Tech feel, interactive, links, hover feedback |
| **Neon Pink** | `#FF4DFF` | 255, 77, 255 | Special events, premium, close buttons |
| **Neon Green** | `#00FF88` | 0, 255, 136 | Success, online status, hit feedback ONLY |

## Background Colors

| Name | HEX | RGB | Usage |
|------|-----|-----|-------|
| **Bg Darkest** | `#0B0A12` | 11, 10, 18 | Main background, sidebar |
| **Bg Dark** | `#11101A` | 17, 16, 26 | Secondary background, panels |
| **Bg Card** | `#18162A` | 24, 22, 42 | Cards, containers, inputs |
| **Bg Card Hover** | `#1E1A35` | 30, 26, 53 | Hover state for cards |
| **Bg Sidebar** | `#0B0A12` | 11, 10, 18 | Sidebar background |

## Text Colors

| Name | HEX | RGB | Usage |
|------|-----|-----|-------|
| **Text Primary** | `#FFFFFF` | 255, 255, 255 | Main text, headings |
| **Text Secondary** | `#A78BFA` | 167, 139, 250 | Secondary text, labels |
| **Text Muted** | `#6B7280` | 107, 114, 128 | Disabled text, placeholders |

## Status Colors

| Name | HEX | RGB | Usage |
|------|-----|-----|-------|
| **Success** | `#00FF88` | 0, 255, 136 | Success states, online, hit confirmation |
| **Warning** | `#FFD700` | 255, 215, 0 | Warnings, idle status |
| **Error** | `#FF4757` | 255, 71, 87 | Errors, offline, dnd status |
| **Info** | `#00FFFF` | 0, 255, 255 | Information, links |

## Online Status Colors

| Name | HEX | Usage |
|------|-----|-------|
| **Online** | `#00FF88` | User is online |
| **Idle** | `#FFD700` | User is idle/away |
| **DND** | `#FF4757` | User is do not disturb |
| **Offline** | `#6B7280` | User is offline |

## Glow Effects

| Name | CSS | Usage |
|------|-----|-------|
| **Glow Primary** | `0 0 20px rgba(139, 92, 246, 0.5)` | Primary buttons, active states |
| **Glow Cyan** | `0 0 15px rgba(0, 255, 255, 0.5)` | Interactive elements, hover feedback |
| **Glow Pink** | `0 0 20px rgba(255, 77, 255, 0.5)` | Special events, premium, close hover |
| **Glow Green** | `0 0 15px rgba(0, 255, 136, 0.5)` | Success, online status |
| **Glow Error** | `0 0 15px rgba(255, 71, 87, 0.5)` | Error states, close button hover |

## Gradients

| Name | CSS | Usage |
|------|-----|-------|
| **Bg Gradient** | `linear-gradient(180deg, #0B0A12 0%, #11101A 100%)` | Main background |
| **Card Gradient** | `linear-gradient(135deg, #18162A 0%, #1E1A35 100%)` | Cards, panels |
| **Sidebar Gradient** | `linear-gradient(180deg, #0B0A12 0%, #11101A 100%)` | Sidebar background |
| **Primary Gradient** | `linear-gradient(135deg, #8B5CF6 0%, #7C3AED 100%)` | Primary buttons, icons |

## Shadows

| Name | CSS | Usage |
|------|-----|-------|
| **Shadow Card** | `0 4px 20px rgba(0, 0, 0, 0.4)` | Cards, panels |
| **Shadow Neon** | `0 0 20px rgba(139, 92, 246, 0.3)` | Neon glow effects |

## Border Colors

| Name | HEX | Usage |
|------|-----|-------|
| **Border Light** | `rgba(255, 255, 255, 0.08)` | Default borders |
| **Border Hover** | `rgba(139, 92, 246, 0.5)` | Hover borders |
| **Border Active** | `rgba(139, 92, 246, 0.8)` | Active borders |

## CSS Variables Template

```css
:root {
  /* Primary */
  --primary: #8B5CF6;
  --primary-hover: #7C3AED;
  --primary-light: #A78BFA;
  
  /* Neon Accents */
  --neon-cyan: #00FFFF;
  --neon-pink: #FF4DFF;
  --neon-green: #00FF88;
  
  /* Backgrounds */
  --bg-darkest: #0B0A12;
  --bg-dark: #11101A;
  --bg-card: #18162A;
  --bg-card-hover: #1E1A35;
  
  /* Text */
  --text-primary: #FFFFFF;
  --text-secondary: #A78BFA;
  --text-muted: #6B7280;
  
  /* Status */
  --success: #00FF88;
  --warning: #FFD700;
  --error: #FF4757;
  
  /* Glows */
  --glow-primary: 0 0 20px rgba(139, 92, 246, 0.5);
  --glow-cyan: 0 0 15px rgba(0, 255, 255, 0.5);
  --glow-pink: 0 0 20px rgba(255, 77, 255, 0.5);
  --glow-green: 0 0 15px rgba(0, 255, 136, 0.5);
  --glow-error: 0 0 15px rgba(255, 71, 87, 0.5);
}
```

## Design Rules

1. **Purple is the brand** - Use #8B5CF6 as main accent
2. **Neon sparingly** - Cyan, Pink only for hover/active states
3. **Green for success only** - Never as a brand color
4. **Backgrounds must be dark** - #0B0A12 to #18162A
5. **Cards need depth** - Always use card gradient
6. **Glow on interaction** - Primary for buttons, Cyan for links
7. **No Windows default** - Custom styled scrollbars, buttons, inputs
