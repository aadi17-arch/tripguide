document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("itinerary-form");
    const submitBtn = document.getElementById("submit-btn");
    const printBtn = document.getElementById("print-btn");
    const copyBtn = document.getElementById("copy-btn");
    const emptyState = document.getElementById("empty-state");
    const outputContainer = document.getElementById("itinerary-output");
    const errorContainer = document.getElementById("error-container");
    const errorText = document.getElementById("error-text");
    const loader = document.getElementById("loader");
    const statusText = document.getElementById("status-text");

    let fullItineraryText = "";

    // Parse simple Markdown for streaming response
    function renderMarkdown(text) {
        // Safe sanitization and simple formatting
        const lines = text.split("\n");
        let html = [];
        let inList = false;
        let inChecklist = false;

        for (let line of lines) {
            let trimmed = line.trim();
            
            // Bold text formatting: **text** -> <strong>text</strong>
            trimmed = trimmed.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");

            // Handle headings: ### Title -> <h3>Title</h3>
            if (trimmed.startsWith("###")) {
                if (inList) { html.push("</ul>"); inList = false; }
                if (inChecklist) { html.push("</ul>"); inChecklist = false; }
                const headerText = trimmed.replace(/^###\s*/, "");
                html.push(`<h3>${headerText}</h3>`);
            } 
            // Handle checklists: - [ ] Item -> <li class="checklist-item"><input type="checkbox"> Item</li>
            else if (trimmed.startsWith("- [ ] ") || trimmed.startsWith("- [x] ")) {
                if (inList) { html.push("</ul>"); inList = false; }
                if (!inChecklist) {
                    html.push("<ul class='checklist'>");
                    inChecklist = true;
                }
                const isChecked = trimmed.startsWith("- [x] ");
                const itemText = trimmed.substring(6);
                html.push(`<li><input type="checkbox" ${isChecked ? 'checked' : ''}> ${itemText}</li>`);
            }
            // Handle bullet lists: - Item -> <li>Item</li>
            else if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
                if (inChecklist) { html.push("</ul>"); inChecklist = false; }
                if (!inList) {
                    html.push("<ul>");
                    inList = true;
                }
                const itemText = trimmed.substring(2);
                html.push(`<li>${itemText}</li>`);
            } 
            // Handle empty line (ends lists or paragraphs)
            else if (trimmed === "") {
                if (inList) { html.push("</ul>"); inList = false; }
                if (inChecklist) { html.push("</ul>"); inChecklist = false; }
            } 
            // Regular paragraphs
            else {
                if (inList) { html.push("</ul>"); inList = false; }
                if (inChecklist) { html.push("</ul>"); inChecklist = false; }
                html.push(`<p>${trimmed}</p>`);
            }
        }

        if (inList) {
            html.push("</ul>");
        }
        if (inChecklist) {
            html.push("</ul>");
        }

        return html.join("\n");
    }

    // Submit handler
    form.addEventListener("submit", async (e) => {
        e.preventDefault();

        // Reset UI state
        emptyState.classList.add("hidden");
        errorContainer.classList.add("hidden");
        outputContainer.classList.add("hidden");
        outputContainer.innerHTML = "";
        loader.classList.remove("hidden");
        submitBtn.disabled = true;
        printBtn.disabled = true;
        copyBtn.disabled = true;
        statusText.textContent = "Crafting your adventure...";
        fullItineraryText = "";

        const formData = {
            destination: document.getElementById("destination").value,
            days: document.getElementById("days").value,
            budget: document.getElementById("budget").value,
            interests: document.getElementById("interests").value
        };

        try {
            const response = await fetch("/api/generate-itinerary", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(formData)
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || "Failed to establish stream connection with server.");
            }

            outputContainer.classList.remove("hidden");
            
            const reader = response.body.getReader();
            const decoder = new TextDecoder("utf-8");
            let buffer = "";

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                // Decode raw chunk
                buffer += decoder.decode(value, { stream: true });
                
                // Process Server-Sent Events format (data: ...)
                const lines = buffer.split("\n");
                // Save the last incomplete line back to the buffer
                buffer = lines.pop();

                for (const line of lines) {
                    const cleanLine = line.trim();
                    if (!cleanLine.startsWith("data: ")) continue;

                    const dataStr = cleanLine.substring(6);
                    if (dataStr === "[DONE]") {
                        statusText.textContent = "Itinerary completed!";
                        printBtn.disabled = false;
                        copyBtn.disabled = false;
                        break;
                    }

                    try {
                        const parsed = JSON.parse(dataStr);
                        if (parsed.error) {
                            throw new Error(parsed.error);
                        }
                        if (parsed.text) {
                            fullItineraryText += parsed.text;
                            outputContainer.innerHTML = renderMarkdown(fullItineraryText);
                            // Scroll to bottom of output container smoothly
                            outputContainer.scrollTop = outputContainer.scrollHeight;
                        }
                    } catch (err) {
                        console.error("Error parsing stream chunk:", err);
                        throw err;
                    }
                }
            }

        } catch (error) {
            console.error("Stream generation failed:", error);
            errorText.textContent = error.message || "An unexpected error occurred during generation.";
            errorContainer.classList.remove("hidden");
            statusText.textContent = "Generation failed";
        } finally {
            loader.classList.add("hidden");
            submitBtn.disabled = false;
        }
    });

    // Copy to clipboard handler
    copyBtn.addEventListener("click", () => {
        // Simple plain-text formatter for copy/paste convenience
        const cleanText = fullItineraryText
            .replace(/###\s+/g, "\n")
            .replace(/\*\*/g, "")
            .replace(/- \[\s\]\s/g, "[ ] ")
            .replace(/- \[[xX]\]\s/g, "[x] ");
        
        navigator.clipboard.writeText(cleanText).then(() => {
            const originalIcon = copyBtn.innerHTML;
            copyBtn.innerHTML = '<i data-lucide="check"></i>';
            lucide.createIcons();
            setTimeout(() => {
                copyBtn.innerHTML = originalIcon;
                lucide.createIcons();
            }, 2000);
        }).catch(err => {
            console.error("Failed to copy text: ", err);
        });
    });

    // Print itinerary handler
    printBtn.addEventListener("click", () => {
        const printWindow = window.open("", "_blank");
        const destination = document.getElementById("destination").value;
        
        printWindow.document.write(`
            <html>
            <head>
                <title>AI Itinerary - ${destination}</title>
                <style>
                    body {
                        font-family: Arial, sans-serif;
                        line-height: 1.6;
                        color: #333;
                        padding: 2.5rem;
                        max-width: 800px;
                        margin: 0 auto;
                    }
                    h3 {
                        color: #10b981;
                        border-bottom: 2px solid #e2e8f0;
                        padding-bottom: 0.5rem;
                        margin-top: 2rem;
                    }
                    p {
                        margin-bottom: 1rem;
                    }
                    ul {
                        margin-bottom: 1.5rem;
                        padding-left: 1.5rem;
                    }
                    li {
                        margin-bottom: 0.5rem;
                    }
                    strong {
                        color: #0f172a;
                    }
                    .header {
                        text-align: center;
                        border-bottom: 3px double #e2e8f0;
                        padding-bottom: 1.5rem;
                        margin-bottom: 2rem;
                    }
                    .header h1 {
                        margin: 0;
                        font-size: 2.2rem;
                        color: #1a1a1a;
                    }
                    .header p {
                        margin: 0.5rem 0 0;
                        color: #666;
                        font-style: italic;
                    }
                    @media print {
                        body { padding: 0; }
                        button { display: none; }
                    }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>TripGuide AI Itinerary</h1>
                    <p>Travel Plan for ${destination}</p>
                </div>
                <div>${renderMarkdown(fullItineraryText)}</div>
                <script>
                    window.onload = function() {
                        window.print();
                    }
                </script>
            </body>
            </html>
        `);
        printWindow.document.close();
    });
});
