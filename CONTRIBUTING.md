# Contributing to JobEaseAI

Thank you for your interest in contributing to **JobEaseAI**! We welcome contributions to help job seekers tailor their resumes and beat ATS systems with strict 1-page formatting guardrails.

---

## 🛠️ Development Setup

1. **Clone the Repository**:
   ```bash
   git clone https://github.com/<your-username>/JobEaseAI.git
   cd JobEaseAI
   ```

2. **Zero Dependencies Installation**:
   JobEaseAI runs on native Node.js (v18+) without requiring external npm packages:
   ```bash
   npm start
   ```
   Or for live-reload development:
   ```bash
   npm run dev
   ```

3. **Run Test Suite**:
   ```bash
   npm test
   ```

---

## 🌿 Contribution Workflow

1. **Fork the Repository** on GitHub.
2. **Create a Feature Branch**:
   ```bash
   git checkout -b feature/amazing-new-feature
   ```
3. **Make Your Changes**:
   - Adhere to the clean separation of data (JSON) and presentation (CSS).
   - Ensure the 1-page guardrail calculations remain accurate.
   - Maintain zero external dependency footprint for core features whenever possible.
4. **Run Tests**:
   ```bash
   node test.js
   ```
5. **Commit Your Changes** following Conventional Commits:
   ```bash
   git commit -m "feat(templates): add new executive serif theme"
   ```
6. **Push to Your Branch**:
   ```bash
   git push origin feature/amazing-new-feature
   ```
7. **Open a Pull Request** describing your changes and testing steps.

---

## 🎨 Adding New Resume Templates

To contribute a new template:
1. Define a CSS class in `public/css/styles.css` matching `.resume-paper.theme-<your-theme>`.
2. Ensure it supports `.density-compact`, `.density-standard`, and `.density-relaxed`.
3. Add the template button to `public/index.html` under `#template-pill-group`.
4. Test that `window.print()` outputs cleanly on a single page.

---

## 📜 Code of Conduct

We are committed to providing a welcoming, inclusive, and harassment-free experience for everyone. Be respectful and constructive in all discussions.
