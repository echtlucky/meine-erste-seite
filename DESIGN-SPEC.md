# LCKY Design System - Visual Design Specification

## Document Information
- **Version**: 1.0.0
- **Last Updated**: 2026-01-31
- **Status**: Draft
- **Author**: LCKY Design Team

---

## Table of Contents
1. [Design Philosophy](#1-design-philosophy)
2. [Color System](#2-color-system)
3. [Typography Hierarchy](#3-typography-hierarchy)
4. [Header Layout](#4-header-layout)
5. [Card System](#5-card-system)
6. [Content Sections](#6-content-sections)
7. [Preview Section Layouts](#7-preview-section-layouts)
8. [Blog Page Editorial Layout](#8-blog-page-editorial-layout)
9. [Footer Design](#9-footer-design)
10. [Interaction & Hover States](#10-interaction--hover-states)
11. [Spacing System](#11-spacing-system)
12. [Responsive Guidelines](#12-responsive-guidelines)

---

## 1. Design Philosophy

### 1.1 Core Principles
The LCKY design system is built on three foundational principles that guide all design decisions:

- **Modern Minimalism**: Clean, uncluttered interfaces that prioritize content over decoration
- **Glass & Depth**: Strategic use of transparency, blur effects, and layered depth to create visual hierarchy
- **Subtle Interactions**: Smooth, purposeful animations that enhance user experience without distraction

### 1.2 Visual Language
- **Primary Style**: Glassmorphism with subtle depth
- **Border Radius**: Ranging from 8px to 24px for softer, friendlier appearances
- **Shadows**: Multi-layered shadows for depth without harshness
- **Backgrounds**: Gradient overlays with background image integration

---

## 2. Color System

### 2.1 Primary Colors
| Color Name | Hex Value | RGB | Usage |
|------------|-----------|-----|-------|
| Primary | `#3B82F6` | 59, 130, 246 | Primary buttons, links, accents |
| Primary Dark | `#2563EB` | 37, 99, 235 | Hover states, active elements |
| Primary Light | `#60A5FA` | 96, 165, 250 | Disabled states, subtle backgrounds |

### 2.2 Neutral Colors
| Color Name | Hex Value | RGB | Usage |
|------------|-----------|-----|-------|
| Surface | `#FFFFFF` | 255, 255, 255 | Card backgrounds, content areas |
| Surface Alt | `#F8FAFC` | 248, 250, 252 | Secondary backgrounds |
| Border | `#E2E8F0` | 226, 232, 240 | Dividers, input borders |
| Text Primary | `#1E293B` | 30, 41, 59 | Headings, primary text |
| Text Secondary | `#64748B` | 100, 116, 139 | Body text, captions |
| Text Muted | `#94A3B8` | 148, 163, 184 | Placeholders, disabled text |

### 2.3 Semantic Colors
| Color Name | Hex Value | RGB | Usage |
|------------|-----------|-----|-------|
| Success | `#10B981` | 16, 185, 129 | Success messages, confirmations |
| Warning | `#F59E0B` | 245, 158, 11 | Warnings, attention needed |
| Error | `#EF4444` | 239, 68, 68 | Errors, validation failures |
| Info | `#06B6D4` | 6, 182, 212 | Informational messages |

### 2.4 Gradient System
```css
/* Primary Gradient */
background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);

/* Glass Overlay Gradient */
background: linear-gradient(180deg, rgba(255, 255, 255, 0.1) 0%, rgba(255, 255, 255, 0.05) 100%);

/* Dark Mode Gradient */
background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
```

---

## 3. Typography Hierarchy

### 3.1 Font Family
```css
/* Primary Font - Inter or system-ui */
font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;

/* Monospace - for code blocks */
font-family: 'JetBrains Mono', 'Fira Code', 'Consolas', monospace;
```

### 3.2 Type Scale
| Element | Font Size | Line Height | Font Weight | Letter Spacing | Example |
|---------|-----------|-------------|-------------|----------------|---------|
| Display | 64px | 1.1 | 700 | -0.02em | # Header |
| H1 | 48px | 1.2 | 700 | -0.01em | ## Header |
| H2 | 36px | 1.25 | 600 | 0 | ### Header |
| H3 | 28px | 1.3 | 600 | 0 | #### Header |
| H4 | 24px | 1.35 | 500 | 0 | ##### Header |
| H5 | 20px | 1.4 | 500 | 0 | ###### Header |
| Body Large | 18px | 1.6 | 400 | 0 | Paragraph |
| Body | 16px | 1.6 | 400 | 0 | Paragraph |
| Body Small | 14px | 1.5 | 400 | 0 | Caption |
| Overline | 12px | 1.5 | 600 | 0.1em | Label |

### 3.3 Typography Classes
```css
/* Display Text */
.display-text {
  font-size: 4rem;
  line-height: 1.1;
  font-weight: 700;
  letter-spacing: -0.02em;
}

/* Heading 1 */
.heading-1 {
  font-size: 3rem;
  line-height: 1.2;
  font-weight: 700;
  letter-spacing: -0.01em;
}

/* Heading 2 */
.heading-2 {
  font-size: 2.25rem;
  line-height: 1.25;
  font-weight: 600;
}

/* Heading 3 */
.heading-3 {
  font-size: 1.75rem;
  line-height: 1.3;
  font-weight: 600;
}

/* Body Text */
.body-text {
  font-size: 1rem;
  line-height: 1.6;
  font-weight: 400;
}

/* Caption */
.caption-text {
  font-size: 0.875rem;
  line-height: 1.5;
  font-weight: 400;
  color: var(--text-secondary);
}
```

---

## 4. Header Layout

### 4.1 Header Structure
The header features a glass morphism design with centered navigation and a subtle blur effect.

```html
<header class="header-glass">
  <nav class="nav-centered">
    <a href="/" class="logo">
      <img src="assets/logo.png" alt="LCKY Logo" />
    </a>
    <ul class="nav-links">
      <li><a href="/" class="nav-link active">Home</a></li>
      <li><a href="/blog" class="nav-link">Blog</a></li>
      <li><a href="/hub-download" class="nav-link">Hub</a></li>
      <li><a href="/admin-panel" class="nav-link">Admin</a></li>
    </ul>
    <div class="header-actions">
      <button class="btn-glass btn-sm">Sign In</button>
    </div>
  </nav>
</header>
```

### 4.2 Glass Morphism Header CSS
```css
.header-glass {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 1000;
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-bottom: 1px solid rgba(255, 255, 255, 0.2);
  box-shadow: 0 4px 30px rgba(0, 0, 0, 0.1);
}

.nav-centered {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 3rem;
  max-width: 1400px;
  margin: 0 auto;
  padding: 1rem 2rem;
}

.nav-links {
  display: flex;
  gap: 2.5rem;
  list-style: none;
  margin: 0;
  padding: 0;
}

.nav-link {
  position: relative;
  color: var(--text-primary);
  text-decoration: none;
  font-weight: 500;
  font-size: 0.95rem;
  padding: 0.5rem 0;
  transition: color 0.2s ease;
}

.nav-link::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 0;
  width: 0;
  height: 2px;
  background: linear-gradient(90deg, var(--primary), var(--primary-light));
  transition: width 0.3s ease;
}

.nav-link:hover::after,
.nav-link.active::after {
  width: 100%;
}

.nav-link.active {
  color: var(--primary);
}
```

### 4.3 Header Variants

#### Variant A: Transparent (Default)
- Background: `rgba(255, 255, 255, 0.1)`
- Blur: `20px`
- Border: `1px solid rgba(255, 255, 255, 0.2)`

#### Variant B: Solid on Scroll
```css
.header-glass.scrolled {
  background: rgba(255, 255, 255, 0.95);
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
}
```

#### Variant C: Dark Mode
```css
.header-glass.dark {
  background: rgba(15, 23, 42, 0.8);
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}
```

### 4.4 Logo Specifications
| Property | Value |
|----------|-------|
| Max Width | 120px |
| Height | Auto |
| Padding | 0.5rem 0 |
| Hover Scale | 1.05 |

---

## 5. Card System

### 5.1 Card Variants

#### 5.1.1 Glass Card (Primary)
```css
.card-glass {
  background: rgba(255, 255, 255, 0.25);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid rgba(255, 255, 255, 0.3);
  border-radius: 16px;
  box-shadow: 
    0 4px 6px rgba(0, 0, 0, 0.05),
    0 10px 40px rgba(0, 0, 0, 0.08);
  padding: 2rem;
  transition: all 0.3s ease;
}
```

#### 5.1.2 Elevated Card
```css
.card-elevated {
  background: #fff;
  border-radius: 16px;
  box-shadow: 
    0 1px 3px rgba(0, 0, 0, 0.08),
    0 4px 12px rgba(0, 0, 0, 0.05),
    0 12px 40px rgba(0, 0, 0, 0.1);
  padding: 2rem;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}
```

#### 5.1.3 Outlined Card
```css
.card-outlined {
  background: transparent;
  border: 2px solid var(--border);
  border-radius: 16px;
  padding: 2rem;
  transition: all 0.3s ease;
}

.card-outlined:hover {
  border-color: var(--primary);
  background: rgba(59, 130, 246, 0.02);
}
```

#### 5.1.4 Interactive Card
```css
.card-interactive {
  background: rgba(255, 255, 255, 0.15);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 20px;
  padding: 2.5rem;
  transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
  cursor: pointer;
}

.card-interactive:hover {
  transform: translateY(-8px) scale(1.02);
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.15);
}
```

### 5.2 Card Sizes
| Size | Padding | Border Radius | Use Case |
|------|---------|---------------|----------|
| Small | 1rem | 12px | Tags, badges, small items |
| Medium | 1.5rem | 16px | Standard cards, blog previews |
| Large | 2rem | 20px | Feature cards, hero sections |
| Extra Large | 3rem | 24px | Modal content, landing sections |

### 5.3 Card Content Patterns

#### Pattern 1: Icon + Title + Description
```html
<article class="card-glass card-interactive">
  <div class="card-icon">
    <img src="assets/icons/feature-icon.svg" alt="" />
  </div>
  <h3 class="card-title">Feature Title</h3>
  <p class="card-description">Description text goes here with optimal line length.</p>
  <a href="#" class="card-link">Learn More →</a>
</article>
```

#### Pattern 2: Image + Title + Meta
```html
<article class="card-elevated card-hover">
  <img src="assets/screenshots/thumbnail.jpg" alt="" class="card-image" />
  <div class="card-content">
    <span class="card-category">Category</span>
    <h3 class="card-title">Article Title</h3>
    <div class="card-meta">
      <span class="card-author">Author</span>
      <span class="card-date">Date</span>
    </div>
  </div>
</article>
```

### 5.4 Depth System
| Level | Shadow | Usage |
|-------|--------|-------|
| 1 | `0 1px 2px rgba(0,0,0,0.05)` | Subtle dividers, flat elements |
| 2 | `0 4px 6px rgba(0,0,0,0.07)` | Cards at rest |
| 3 | `0 10px 25px rgba(0,0,0,0.1)` | Hovered cards, dropdowns |
| 4 | `0 20px 50px rgba(0,0,0,0.15)` | Active cards, modals |

---

## 6. Content Sections

### 6.1 Section Structure
```html
<section class="section" id="section-id">
  <div class="section-container">
    <div class="section-header">
      <span class="section-label">Label</span>
      <h2 class="section-title">Section Title</h2>
      <p class="section-description">Optional description text.</p>
    </div>
    <div class="section-content">
      <!-- Content grid or blocks -->
    </div>
  </div>
</section>
```

### 6.2 Section Variants

#### Hero Section
```css
.section-hero {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: 
    linear-gradient(180deg, rgba(255,255,255,0) 0%, rgba(248,250,252,0.5) 100%),
    url('../assets/bg.png') center/cover no-repeat;
  padding: 6rem 2rem;
}

.hero-content {
  text-align: center;
  max-width: 800px;
}

.hero-title {
  font-size: 4rem;
  font-weight: 700;
  margin-bottom: 1.5rem;
  background: linear-gradient(135deg, #1e293b 0%, #475569 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.hero-subtitle {
  font-size: 1.25rem;
  color: var(--text-secondary);
  margin-bottom: 2.5rem;
  line-height: 1.7;
}
```

#### Feature Section
```css
.section-features {
  padding: 6rem 2rem;
  background: var(--surface-alt);
}

.features-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 2rem;
  max-width: 1200px;
  margin: 0 auto;
}
```

#### Content Section
```css
.section-content {
  padding: 5rem 2rem;
  max-width: 1400px;
  margin: 0 auto;
}
```

### 6.3 Section Layouts

#### 2-Column Layout
```css
.two-column {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 4rem;
  align-items: center;
}

@media (max-width: 768px) {
  .two-column {
    grid-template-columns: 1fr;
    gap: 3rem;
  }
}
```

#### 3-Column Grid
```css
.three-column-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 2rem;
}

@media (max-width: 1024px) {
  .three-column-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 640px) {
  .three-column-grid {
    grid-template-columns: 1fr;
  }
}
```

#### Asymmetric Layout
```css
.asymmetric-layout {
  display: grid;
  grid-template-columns: 2fr 1fr;
  gap: 3rem;
}
```

---

## 7. Preview Section Layouts

### 7.1 Screenshot Gallery
```html
<section class="section-preview" id="screenshots">
  <div class="section-container">
    <div class="section-header">
      <span class="section-label">Screenshots</span>
      <h2 class="section-title">App Preview</h2>
    </div>
    <div class="screenshot-gallery">
      <div class="screenshot-main">
        <img src="assets/screenshots/logo-size-1280.png" alt="Main Screenshot" />
      </div>
      <div class="screenshot-thumbs">
        <img src="assets/screenshots/thumb-1.jpg" alt="Screenshot 1" class="screenshot-thumb active" />
        <img src="assets/screenshots/thumb-2.jpg" alt="Screenshot 2" class="screenshot-thumb" />
        <img src="assets/screenshots/thumb-3.jpg" alt="Screenshot 3" class="screenshot-thumb" />
      </div>
    </div>
  </div>
</section>
```

### 7.2 Screenshot Gallery CSS
```css
.screenshot-gallery {
  max-width: 1000px;
  margin: 0 auto;
}

.screenshot-main {
  background: rgba(255, 255, 255, 0.5);
  border-radius: 16px;
  padding: 1rem;
  margin-bottom: 1.5rem;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.1);
}

.screenshot-main img {
  width: 100%;
  border-radius: 12px;
}

.screenshot-thumbs {
  display: flex;
  gap: 1rem;
}

.screenshot-thumb {
  width: 120px;
  height: 70px;
  object-fit: cover;
  border-radius: 8px;
  cursor: pointer;
  opacity: 0.6;
  transition: all 0.2s ease;
  border: 2px solid transparent;
}

.screenshot-thumb:hover,
.screenshot-thumb.active {
  opacity: 1;
  border-color: var(--primary);
  transform: scale(1.05);
}
```

### 7.3 Feature Preview Cards
```css
.preview-card {
  background: rgba(255, 255, 255, 0.6);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.4);
  border-radius: 20px;
  padding: 2rem;
  transition: all 0.3s ease;
}

.preview-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 15px 40px rgba(0, 0, 0, 0.1);
}

.preview-image {
  width: 100%;
  height: 200px;
  object-fit: cover;
  border-radius: 12px;
  margin-bottom: 1.5rem;
}
```

### 7.4 Comparison Layout
```css
.comparison-grid {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  gap: 2rem;
  align-items: start;
}

.comparison-item {
  background: var(--surface);
  border-radius: 16px;
  padding: 2rem;
}

.comparison-arrow {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 2rem;
  color: var(--primary);
}
```

---

## 8. Blog Page Editorial Layout

### 8.1 Blog Post Layout
```html
<article class="blog-post">
  <header class="blog-header">
    <div class="blog-meta">
      <span class="blog-category">Category</span>
      <span class="blog-date">January 31, 2026</span>
      <span class="blog-read-time">5 min read</span>
    </div>
    <h1 class="blog-title">Blog Post Title Goes Here</h1>
    <div class="blog-author">
      <img src="assets/avatars/author.jpg" alt="Author" class="author-avatar" />
      <div class="author-info">
        <span class="author-name">Author Name</span>
        <span class="author-role">Role</span>
      </div>
    </div>
  </header>
  
  <div class="blog-featured-image">
    <img src="assets/blog/featured.jpg" alt="Featured Image" />
  </div>
  
  <div class="blog-content">
    <!-- Article content -->
  </div>
  
  <footer class="blog-footer">
    <div class="blog-tags">
      <a href="#" class="tag">Tag 1</a>
      <a href="#" class="tag">Tag 2</a>
    </div>
    <div class="blog-share">
      <!-- Share buttons -->
    </div>
  </footer>
</article>
```

### 8.2 Blog Content Typography
```css
.blog-content {
  max-width: 720px;
  margin: 0 auto;
  padding: 2rem;
}

.blog-content h2 {
  font-size: 2rem;
  margin: 3rem 0 1.5rem;
}

.blog-content p {
  font-size: 1.125rem;
  line-height: 1.8;
  margin-bottom: 1.5rem;
  color: var(--text-primary);
}

.blog-content blockquote {
  border-left: 4px solid var(--primary);
  padding-left: 1.5rem;
  margin: 2rem 0;
  font-style: italic;
  color: var(--text-secondary);
}

.blog-content code {
  background: rgba(59, 130, 246, 0.1);
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-family: var(--font-mono);
  font-size: 0.9em;
}

.blog-content pre {
  background: #1e293b;
  padding: 1.5rem;
  border-radius: 12px;
  overflow-x: auto;
  margin: 2rem 0;
}

.blog-content pre code {
  background: transparent;
  padding: 0;
  color: #e2e8f0;
}
```

### 8.3 Blog Card Grid
```css
.blog-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
  gap: 2rem;
}

.blog-card {
  background: rgba(255, 255, 255, 0.6);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.3);
  border-radius: 20px;
  overflow: hidden;
  transition: all 0.3s ease;
}

.blog-card:hover {
  transform: translateY(-6px);
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.12);
}

.blog-card-image {
  width: 100%;
  height: 220px;
  object-fit: cover;
}

.blog-card-content {
  padding: 1.5rem;
}

.blog-card-meta {
  display: flex;
  gap: 1rem;
  font-size: 0.85rem;
  color: var(--text-secondary);
  margin-bottom: 1rem;
}

.blog-card-title {
  font-size: 1.25rem;
  margin-bottom: 0.75rem;
}

.blog-card-excerpt {
  font-size: 0.95rem;
  color: var(--text-secondary);
  line-height: 1.6;
}
```

### 8.4 Editorial Elements

#### Pull Quote
```css
.pull-quote {
  font-size: 1.5rem;
  font-weight: 500;
  text-align: center;
  padding: 3rem;
  background: linear-gradient(135deg, rgba(59, 130, 246, 0.05) 0%, rgba(139, 92, 246, 0.05) 100%);
  border-radius: 16px;
  margin: 3rem 0;
}
```

#### Callout Box
```css
.callout {
  padding: 1.5rem;
  border-radius: 12px;
  margin: 2rem 0;
  display: flex;
  gap: 1rem;
}

.callout.info {
  background: rgba(6, 182, 212, 0.1);
  border-left: 4px solid var(--info);
}

.callout.warning {
  background: rgba(245, 158, 11, 0.1);
  border-left: 4px solid var(--warning);
}
```

---

## 9. Footer Design

### 9.1 Footer Structure
```html
<footer class="footer-glass">
  <div class="footer-container">
    <div class="footer-main">
      <div class="footer-brand">
        <img src="assets/logo.png" alt="LCKY Logo" class="footer-logo" />
        <p class="footer-tagline">Modern solutions for modern challenges.</p>
      </div>
      
      <div class="footer-links">
        <div class="footer-column">
          <h4 class="footer-heading">Navigation</h4>
          <ul>
            <li><a href="/">Home</a></li>
            <li><a href="/blog">Blog</a></li>
            <li><a href="/hub-download">Download Hub</a></li>
          </ul>
        </div>
        
        <div class="footer-column">
          <h4 class="footer-heading">Legal</h4>
          <ul>
            <li><a href="/impressum">Impressum</a></li>
            <li><a href="/datenschutz">Datenschutz</a></li>
          </ul>
        </div>
      </div>
      
      <div class="footer-social">
        <!-- Social links -->
      </div>
    </div>
    
    <div class="footer-bottom">
      <p class="copyright">© 2026 LCKY. All rights reserved.</p>
      <a href="/admin-panel" class="admin-link">Admin Access</a>
    </div>
  </div>
</footer>
```

### 9.2 Footer Glass Morphism CSS
```css
.footer-glass {
  background: rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  padding: 4rem 2rem 2rem;
}

.footer-container {
  max-width: 1400px;
  margin: 0 auto;
}

.footer-main {
  display: grid;
  grid-template-columns: 2fr 1fr 1fr 1fr;
  gap: 3rem;
  margin-bottom: 3rem;
}

.footer-brand {
  max-width: 300px;
}

.footer-logo {
  width: 100px;
  margin-bottom: 1rem;
}

.footer-tagline {
  color: var(--text-secondary);
  font-size: 0.95rem;
  line-height: 1.6;
}

.footer-heading {
  font-size: 0.85rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 1.25rem;
  color: var(--text-primary);
}

.footer-links ul {
  list-style: none;
  padding: 0;
  margin: 0;
}

.footer-links a {
  color: var(--text-secondary);
  text-decoration: none;
  font-size: 0.95rem;
  display: block;
  padding: 0.4rem 0;
  transition: color 0.2s ease;
}

.footer-links a:hover {
  color: var(--primary);
}
```

### 9.3 Footer Bottom
```css
.footer-bottom {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 2rem;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.copyright {
  font-size: 0.875rem;
  color: var(--text-muted);
}

.admin-link {
  font-size: 0.8rem;
  color: var(--text-muted);
  text-decoration: none;
  opacity: 0.6;
  transition: all 0.2s ease;
}

.admin-link:hover {
  opacity: 1;
  color: var(--text-secondary);
}
```

### 9.4 Admin Access Subtle Link
The admin access link in the footer is intentionally subtle to maintain the clean aesthetic while providing necessary access:

- **Opacity**: 0.6 (default)
- **Hover Opacity**: 1
- **Font Size**: 0.8rem
- **Color**: `var(--text-muted)`
- **Transition**: 0.2s ease

---

## 10. Interaction & Hover States

### 10.1 Button States

#### Primary Button
```css
.btn-primary {
  background: linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%);
  color: white;
  padding: 0.875rem 2rem;
  border-radius: 12px;
  font-weight: 600;
  border: none;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 4px 15px rgba(59, 130, 246, 0.3);
}

.btn-primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 25px rgba(59, 130, 246, 0.4);
}

.btn-primary:active {
  transform: translateY(0);
  box-shadow: 0 2px 10px rgba(59, 130, 246, 0.3);
}
```

#### Glass Button
```css
.btn-glass {
  background: rgba(255, 255, 255, 0.15);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.3);
  color: var(--text-primary);
  padding: 0.75rem 1.5rem;
  border-radius: 10px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s ease;
}

.btn-glass:hover {
  background: rgba(255, 255, 255, 0.25);
  border-color: rgba(255, 255, 255, 0.5);
  transform: translateY(-1px);
}
```

### 10.2 Link Hover Effects

#### Underline Animation
```css
.link-underline {
  position: relative;
  color: var(--text-primary);
  text-decoration: none;
}

.link-underline::after {
  content: '';
  position: absolute;
  bottom: -2px;
  left: 0;
  width: 100%;
  height: 2px;
  background: var(--primary);
  transform: scaleX(0);
  transform-origin: right;
  transition: transform 0.3s ease;
}

.link-underline:hover::after {
  transform: scaleX(1);
  transform-origin: left;
}
```

#### Opacity Transition
```css
.link-fade {
  color: var(--text-primary);
  text-decoration: none;
  transition: opacity 0.2s ease, color 0.2s ease;
}

.link-fade:hover {
  opacity: 0.7;
}
```

### 10.3 Card Hover Interactions

#### Lift Effect
```css
.card-hover-lift {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.card-hover-lift:hover {
  transform: translateY(-8px);
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.12);
}
```

#### Scale Effect
```css
.card-hover-scale {
  transition: all 0.3s ease;
}

.card-hover-scale:hover {
  transform: scale(1.03);
}
```

#### Glow Effect
```css
.card-hover-glow {
  transition: all 0.3s ease;
}

.card-hover-glow:hover {
  box-shadow: 
    0 10px 40px rgba(59, 130, 246, 0.2),
    0 0 80px rgba(59, 130, 246, 0.1);
}
```

### 10.4 Image Hover Effects

#### Zoom
```css
.image-zoom {
  overflow: hidden;
  border-radius: inherit;
}

.image-zoom img {
  transition: transforms ease;
}

 0.5.image-zoom:hover img {
  transform: scale(1.1);
}
```

#### Grayscale to Color
```css
.image-grayscale {
  transition: filter 0.3s ease;
}

.image-grayscale:hover {
  filter: grayscale(0);
}
```

### 10.5 Focus States
```css
/* Keyboard navigation focus */
:focus-visible {
  outline: 2px solid var(--primary);
  outline-offset: 2px;
}

/* Remove default focus for mouse users */
:focus:not(:focus-visible) {
  outline: none;
}
```

### 10.6 Loading States

#### Skeleton Loading
```css
.skeleton {
  background: linear-gradient(
    90deg,
    rgba(226, 232, 240, 0.8) 25%,
    rgba(241, 245, 249, 0.8) 50%,
    rgba(226, 232, 240, 0.8) 75%
  );
  background-size: 200% 100%;
  animation: skeleton-loading 1.5s infinite;
  border-radius: 8px;
}

@keyframes skeleton-loading {
  0% {
    background-position: 200% 0;
  }
  100% {
    background-position: -200% 0;
  }
}
```

#### Spinner
```css
.spinner {
  width: 24px;
  height: 24px;
  border: 3px solid rgba(59, 130, 246, 0.2);
  border-top-color: var(--primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
```

### 10.7 Transition Timing
| Duration | Use Case |
|----------|----------|
| 150ms | Micro-interactions, button clicks |
| 200-300ms | Hover states, color changes |
| 300-500ms | Card lifts, scale effects |
| 400-600ms | Page transitions, modal reveals |

### 10.8 Easing Functions
```css
/* Standard ease */
ease: cubic-bezier(0.4, 0, 0.2, 1);

/* Smooth ease-in-out */
ease-in-out: cubic-bezier(0.4, 0, 0.2, 1);

/* Bounce effect */
bounce: cubic-bezier(0.175, 0.885, 0.32, 1.275);

/* Material easing */
material: cubic-bezier(0.4, 0, 0.2, 1);
```

---

## 11. Spacing System

### 11.1 Base Scale
| Token | Pixels | REM | Usage |
|-------|--------|-----|-------|
| xs | 4px | 0.25 | Tight spacing, inline elements |
| sm | 8px | 0.5 | Small gaps, button internal |
| md | 16px | 1 | Standard gap, paragraph margin |
| lg | 24px | 1.5 | Section spacing, cards |
| xl | 32px | 2 | Major sections, containers |
| 2xl | 48px | 3 | Hero sections, large containers |
| 3xl | 64px | 4 | Page margins, full sections |
| 4xl | 96px | 6 | Maximum spacing, whitespace |

### 11.2 CSS Custom Properties
```css
:root {
  --space-xs: 0.25rem;
  --space-sm: 0.5rem;
  --space-md: 1rem;
  --space-lg: 1.5rem;
  --space-xl: 2rem;
  --space-2xl: 3rem;
  --space-3xl: 4rem;
  --space-4xl: 6rem;
}
```

### 11.3 Spacing Utilities
```css
/* Margins */
.mt-1 { margin-top: 0.25rem; }
.mt-2 { margin-top: 0.5rem; }
.mt-4 { margin-top: 1rem; }
.mt-8 { margin-top: 2rem; }
.mt-16 { margin-top: 4rem; }

.mb-1 { margin-bottom: 0.25rem; }
.mb-2 { margin-bottom: 0.5rem; }
.mb-4 { margin-bottom: 1rem; }
.mb-8 { margin-bottom: 2rem; }
.mb-16 { margin-bottom: 4rem; }

/* Padding */
.p-4 { padding: 1rem; }
.p-6 { padding: 1.5rem; }
.p-8 { padding: 2rem; }
.p-12 { padding: 3rem; }

/* Gap */
.gap-2 { gap: 0.5rem; }
.gap-4 { gap: 1rem; }
.gap-6 { gap: 1.5rem; }
.gap-8 { gap: 2rem; }
```

---

## 12. Responsive Guidelines

### 12.1 Breakpoints
| Breakpoint | Pixels | Target |
|------------|--------|--------|
| xs | 0-479px | Small phones |
| sm | 480-639px | Large phones |
| md | 640-767px | Tablets portrait |
| lg | 768-1023px | Tablets landscape |
| xl | 1024-1279px | Small laptops |
| 2xl | 1280-1535px | Desktops |
| 3xl | 1536px+ | Large screens |

### 12.2 Container Widths
```css
.container {
  width: 100%;
  max-width: 1400px;
  margin: 0 auto;
  padding: 0 1.5rem;
}

@media (max-width: 768px) {
  .container {
    padding: 0 1rem;
  }
}
```

### 12.3 Responsive Typography
```css
/* Mobile-first base */
html {
  font-size: 16px;
}

@media (max-width: 768px) {
  html {
    font-size: 14px;
  }
}

/* Responsive heading sizes */
h1 { font-size: 2.5rem; }
h2 { font-size: 2rem; }
h3 { font-size: 1.5rem; }

@media (max-width: 768px) {
  h1 { font-size: 2rem; }
  h2 { font-size: 1.5rem; }
  h3 { font-size: 1.25rem; }
}
```

### 12.4 Responsive Grid
```css
.grid-auto-fit {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 2rem;
}

/* Mobile: single column */
@media (max-width: 640px) {
  .grid-auto-fit {
    grid-template-columns: 1fr;
  }
}
```

### 12.5 Touch Target Sizes
```css
/* Minimum touch target */
.touch-target {
  min-height: 44px;
  min-width: 44px;
}

/* Spacing between touch targets */
.touch-spacing > * + * {
  margin-top: 1rem;
}
```

---

## Appendices

### A. Browser Support
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+
- iOS Safari 14+
- Android Chrome 90+

### B. Accessibility Checklist
- [ ] All images have alt text
- [ ] Color contrast meets WCAG 2.1 AA (4.5:1)
- [ ] Focus states visible
- [ ] Semantic HTML elements used
- [ ] Reduced motion respected
- [ ] Touch targets minimum 44x44px

### C. Performance Guidelines
- Images optimized and lazy loaded
- CSS minified in production
- Animations use `transform` and `opacity` only
- Font subsets loaded as needed
- Critical CSS inlined

---

## Revision History
| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-01-31 | Initial specification |

---

*Document maintained by LCKY Design Team*
