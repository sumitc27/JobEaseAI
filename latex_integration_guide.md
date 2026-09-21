# LaTeX Resume Generation Pipeline

This document outlines the architecture and implementation for compiling user resume data (JSON) into a formatted PDF using LaTeX.

## 1. System Architecture

1.  **Frontend (Next.js):** Maintains the resume state as a JSON object. Edits are debounced (delayed by ~800ms) before sending a POST request to the backend.
2.  **Backend (FastAPI):** Receives the JSON data.
3.  **Templating (Jinja2):** Injects the JSON data into a `.tex` template.
4.  **Compilation (Tectonic):** A headless, lightweight TeX engine compiles the `.tex` file into a PDF in a temporary, isolated directory.
5.  **Response:** The backend returns the raw PDF binary stream to the frontend for display.

## 2. Prerequisites & Dependencies

### System Requirements
You must install **Tectonic**, a modern, self-contained LaTeX engine.
*   **macOS:** `brew install tectonic`
*   **Linux (Ubuntu/Debian):** `sudo apt-get install tectonic` or download the binary from their GitHub releases.

### Python Dependencies
Add these to your `requirements.txt`:
```txt
fastapi
uvicorn
jinja2
pydantic
```

## 3. Backend Implementation (FastAPI)

Create a dedicated module for PDF generation (e.g., `services/pdf_generator.py`).

### A. LaTeX Character Sanitizer
Users and AI might generate characters that break LaTeX (like `&`, `%`, `$`). These must be escaped before templating.

```python
import re

def escape_latex(text: str) -> str:
    if not isinstance(text, str):
        return text
    conv = {
        '&': r'\&',
        '%': r'\%',
        '$': r'\$',
        '#': r'\#',
        '_': r'\_',
        '{': r'\{',
        '}': r'\}',
        '~': r'\textasciitilde{}',
        '^': r'\textasciicircum{}',
        '\\': r'\textbackslash{}',
    }
    regex = re.compile('|'.join(re.escape(str(key)) for key in sorted(conv.keys(), key=lambda item: -len(item))))
    return regex.sub(lambda match: conv[match.group()], text)
```

### B. Jinja2 Environment Configuration
LaTeX heavily uses `{` and `}`, which conflicts with default Jinja2 syntax. We configure Jinja2 to use custom delimiters (e.g., `\VAR{...}`).

```python
import jinja2

# Configure Jinja2 to avoid LaTeX syntax conflicts
jinja_env = jinja2.Environment(
    block_start_string=r'\BLOCK{',
    block_end_string='}',
    variable_start_string=r'\VAR{',
    variable_end_string='}',
    comment_start_string=r'\#{',
    comment_end_string='}',
    line_statement_prefix='%%',
    line_comment_prefix='%#',
    trim_blocks=True,
    autoescape=False,
    loader=jinja2.FileSystemLoader('templates/') # Ensure you have a 'templates' folder
)
jinja_env.filters['escape_latex'] = escape_latex
```

### C. The Compilation Endpoint
This endpoint safely generates the PDF in a temporary directory to avoid concurrency issues when multiple users generate resumes at the same time.

```python
from fastapi import APIRouter, HTTPException
from fastapi.responses import Response
import subprocess
import tempfile
import os

router = APIRouter()

@router.post("/compile")
async def compile_resume(resume_data: dict):
    template = jinja_env.get_template("resume_template.tex")
    rendered_tex = template.render(**resume_data)

    # Use a temporary directory for safe concurrent compilation
    with tempfile.TemporaryDirectory() as tmpdir:
        tex_file_path = os.path.join(tmpdir, "resume.tex")
        pdf_file_path = os.path.join(tmpdir, "resume.pdf")

        with open(tex_file_path, "w", encoding="utf-8") as f:
            f.write(rendered_tex)

        # Execute Tectonic compiler
        result = subprocess.run(
            ["tectonic", "resume.tex"],
            cwd=tmpdir,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True
        )

        if result.returncode != 0:
            print(f"Tectonic Error: {result.stderr}")
            raise HTTPException(status_code=400, detail="Failed to compile LaTeX document.")

        # Read the generated PDF
        with open(pdf_file_path, "rb") as f:
            pdf_bytes = f.read()

    return Response(content=pdf_bytes, media_type="application/pdf")
```

## 4. The LaTeX Template (`templates/resume_template.tex`)

Place this inside a `templates/` folder in your backend directory. Notice the use of `\VAR{}` and `\BLOCK{}`.

```latex
\documentclass[letterpaper,10pt]{article}
\usepackage[margin=0.5in]{geometry}
\usepackage{titlesec}
\usepackage{enumitem}

% Formatting overrides
\titleformat{\section}{\large\bfseries}{}{0em}{}[\titlerule]
\titlespacing*{\section}{0pt}{*1.5}{*1}

\begin{document}
\pagestyle{empty} % Remove page numbers

% Header
\begin{center}
    \textbf{\Huge \VAR{ personal_info.name | escape_latex }} \\
    \vspace{2pt}
    \VAR{ personal_info.email | escape_latex } | \VAR{ personal_info.phone | escape_latex } | \VAR{ personal_info.linkedin | escape_latex }
\end{center}

% Experience Section
\section*{Experience}
\BLOCK{ for job in experience }
\noindent
\textbf{\VAR{ job.company | escape_latex }} \hfill \VAR{ job.location | escape_latex } \\
\textit{\VAR{ job.role | escape_latex }} \hfill \VAR{ job.dates | escape_latex } \\
\begin{itemize}[noitemsep,topsep=0pt,leftmargin=1.2em]
    \BLOCK{ for bullet in job.bullets }
    \item \VAR{ bullet | escape_latex }
    \BLOCK{ endfor }
\end{itemize}
\vspace{4pt}
\BLOCK{ endfor }

% Skills Section
\section*{Skills}
\begin{itemize}[noitemsep,topsep=0pt,leftmargin=1.2em]
    \BLOCK{ for skill_group in skills }
    \item \textbf{\VAR{ skill_group.category | escape_latex }}: \VAR{ skill_group.items | join(', ') | escape_latex }
    \BLOCK{ endfor }
\end{itemize}

\end{document}
```

## 5. Frontend Integration (Next.js)

To display the generated PDF, use a debounced fetch request.

```javascript
import { useState, useEffect } from 'react';
import { useDebounce } from 'use-debounce'; // npm install use-debounce

export default function ResumePreview({ resumeData }) {
    const [pdfUrl, setPdfUrl] = useState(null);
    const [debouncedData] = useDebounce(resumeData, 800); // 800ms delay

    useEffect(() => {
        const fetchPdf = async () => {
            try {
                const response = await fetch('/api/compile', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(debouncedData),
                });
                
                if (response.ok) {
                    const blob = await response.blob();
                    const url = URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }));
                    setPdfUrl(url);
                }
            } catch (error) {
                console.error("Failed to generate PDF:", error);
            }
        };

        if (debouncedData) fetchPdf();

        // Cleanup blob URL to prevent memory leaks
        return () => {
            if (pdfUrl) URL.revokeObjectURL(pdfUrl);
        };
    }, [debouncedData]);

    return (
        <div className="h-full w-full">
            {pdfUrl ? (
                <iframe src={pdfUrl} className="w-full h-full border-none" title="Resume Preview" />
            ) : (
                <div className="flex h-full items-center justify-center">Loading Preview...</div>
            )}
        </div>
    );
}
```