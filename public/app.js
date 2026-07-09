document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("itinerary-form");
    const submitBtn = document.getElementById("submit-btn");
    const printBtn = document.getElementById("print-btn");
    const copyBtn = document.getElementById("copy-btn");
    const resetBtn = document.getElementById("reset-btn");
    const emptyState = document.getElementById("empty-state");
    const outputContainer = document.getElementById("itinerary-output");
    const errorContainer = document.getElementById("error-container");
    const errorText = document.getElementById("error-text");
    const loader = document.getElementById("loader");
    const statusText = document.getElementById("status-text");
    const postmarkStamp = document.getElementById("postmark-stamp");
    const stampDestination = document.getElementById("stamp-destination");

    let fullItineraryText = "";
    let currentDestination = "";

    // Boarding Pass Markdown Parser
    function renderMarkdown(text) {
        const lines = text.split("\n");
        let html = [];
        let inList = false;
        let inChecklist = false;
        let inRouteList = false;
        let inDayBlock = false;

        for (let line of lines) {
            let trimmed = line.trim();
            
            // Format bold text (**text** -> <strong>text</strong>)
            trimmed = trimmed.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");

            // Handle Horizontal Rules: ---
            if (/^---+\s*$/.test(trimmed)) {
                if (inList) { html.push("</ul>"); inList = false; }
                if (inChecklist) { html.push("</ul>"); inChecklist = false; }
                if (inRouteList) { html.push("</div>"); inRouteList = false; }
                if (inDayBlock) {
                    html.push("</div></div></div>");
                    inDayBlock = false;
                }
                html.push("<hr>");
                continue;
            }

            // Handle Day Headings: ### Day X: Title
            if (trimmed.startsWith("### Day")) {
                if (inList) { html.push("</ul>"); inList = false; }
                if (inChecklist) { html.push("</ul>"); inChecklist = false; }
                if (inRouteList) { html.push("</div>"); inRouteList = false; }
                if (inDayBlock) {
                    html.push("</div></div></div>"); // Closes collapsible-content, day-col-right, day-block
                    inDayBlock = false;
                }

                const dayMatch = trimmed.match(/^### Day\s+(\d+):\s*(.*)$/i);
                if (dayMatch) {
                    const dayNum = dayMatch[1];
                    const dayTitle = dayMatch[2];
                    html.push(`
                        <div class="day-block">
                            <div class="day-col-left">
                                <span class="day-number">${dayNum.padStart(2, '0')}</span>
                                <span class="day-label">DAY</span>
                            </div>
                            <div class="day-col-right">
                                <h3 class="day-title">${dayTitle}</h3>
                                <div class="collapsible-content">
                    `);
                    inDayBlock = true;
                }
            }
            // Handle Other Headings (e.g. ### Packing Checklist)
            else if (trimmed.startsWith("###")) {
                if (inList) { html.push("</ul>"); inList = false; }
                if (inChecklist) { html.push("</ul>"); inChecklist = false; }
                if (inRouteList) { html.push("</div>"); inRouteList = false; }
                if (inDayBlock) {
                    html.push("</div></div></div>");
                    inDayBlock = false;
                }
                const headerText = trimmed.replace(/^###\s*/, "");
                html.push(`<h3>${headerText}</h3>`);
            }
            // Handle Route Stops: * HH:MM - Stop Name: Note
            else if (trimmed.startsWith("* ") && /^\*\s*\d{2}:\d{2}\s*-/.test(trimmed)) {
                if (inList) { html.push("</ul>"); inList = false; }
                if (inChecklist) { html.push("</ul>"); inChecklist = false; }
                if (!inRouteList) {
                    html.push("<div class='route-list'>");
                    inRouteList = true;
                }
                const routeMatch = trimmed.match(/^\*\s*(\d{2}:\d{2})\s*-\s*([^:]+):\s*(.+)$/);
                if (routeMatch) {
                    const time = routeMatch[1];
                    const stopName = routeMatch[2];
                    const note = routeMatch[3];
                    html.push(`
                        <div class="route-stop">
                            <div class="stop-header">
                                <span class="stop-time">${time}</span>
                                <span class="stop-name">${stopName}</span>
                            </div>
                            <div class="stop-note">${note}</div>
                        </div>
                    `);
                }
            }
            // Handle Checklists: - [ ] Item
            else if (trimmed.startsWith("- [ ] ") || trimmed.startsWith("- [x] ")) {
                if (inList) { html.push("</ul>"); inList = false; }
                if (inRouteList) { html.push("</div>"); inRouteList = false; }
                if (!inChecklist) {
                    html.push("<ul class='checklist'>");
                    inChecklist = true;
                }
                const isChecked = trimmed.startsWith("- [x] ");
                const itemText = trimmed.substring(6);
                html.push(`<li><input type="checkbox" ${isChecked ? 'checked' : ''}> ${itemText}</li>`);
            }
            // Handle standard bullet points (un-ordered lists)
            else if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
                if (inChecklist) { html.push("</ul>"); inChecklist = false; }
                if (inRouteList) { html.push("</div>"); inRouteList = false; }
                if (!inList) {
                    html.push("<ul>");
                    inList = true;
                }
                const itemText = trimmed.substring(2);
                html.push(`<li>${itemText}</li>`);
            }
            // Handle empty line
            else if (trimmed === "") {
                if (inList) { html.push("</ul>"); inList = false; }
                if (inChecklist) { html.push("</ul>"); inChecklist = false; }
                if (inRouteList) { html.push("</div>"); inRouteList = false; }
            }
            // Regular text
            else {
                if (inList) { html.push("</ul>"); inList = false; }
                if (inChecklist) { html.push("</ul>"); inChecklist = false; }
                if (inRouteList) { html.push("</div>"); inRouteList = false; }
                html.push(`<p>${trimmed}</p>`);
            }
        }

        // Close outstanding wrappers
        if (inList) html.push("</ul>");
        if (inChecklist) html.push("</ul>");
        if (inRouteList) html.push("</div>");
        if (inDayBlock) html.push("</div></div></div>");

        return html.join("\n");
    }

    // Submit handler
    form.addEventListener("submit", async (e) => {
        e.preventDefault();

        // Get details
        currentDestination = document.getElementById("destination").value;
        const days = document.getElementById("days").value;
        const budget = document.getElementById("budget").value;

        // Reset UI state
        emptyState.classList.add("hidden");
        errorContainer.classList.add("hidden");
        outputContainer.classList.add("hidden");
        postmarkStamp.classList.add("hidden");
        outputContainer.innerHTML = "";
        loader.classList.remove("hidden");
        submitBtn.disabled = true;
        printBtn.disabled = true;
        copyBtn.disabled = true;
        statusText.textContent = `${currentDestination} · ${days} days · ${budget}`;
        fullItineraryText = "";

        const formData = {
            destination: currentDestination,
            days: days,
            budget: budget,
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

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split("\n");
                buffer = lines.pop();

                for (const line of lines) {
                    const cleanLine = line.trim();
                    if (!cleanLine.startsWith("data: ")) continue;

                    const dataStr = cleanLine.substring(6);
                    if (dataStr === "[DONE]") {
                        printBtn.disabled = false;
                        copyBtn.disabled = false;
                        
                        // Set stamp text and reveal stamp
                        stampDestination.textContent = currentDestination.toUpperCase();
                        postmarkStamp.classList.remove("hidden");
                        
                        makeSectionsCollapsible();
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
        const cleanText = fullItineraryText
            .replace(/###\s+/g, "\n")
            .replace(/\*\s*(\d{2}:\d{2})\s*-\s*([^:]+):\s*(.+)/g, "$1: $2 — $3")
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
        
        printWindow.document.write(`
            <html>
            <head>
                <title>Itinerary — ${currentDestination}</title>
                <!-- Google Fonts -->
                <link rel="preconnect" href="https://fonts.googleapis.com">
                <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
                <link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600;9..144,700&family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:wght@400;500;600&display=swap" rel="stylesheet">
                <style>
                    body {
                        font-family: 'IBM Plex Sans', sans-serif;
                        line-height: 1.6;
                        color: #1a1812;
                        padding: 3rem;
                        max-width: 800px;
                        margin: 0 auto;
                        background-color: #faf9f6;
                    }
                    
                    h1 {
                        font-family: 'Fraunces', serif;
                        font-size: 2.2rem;
                        color: #0e5c4a;
                        margin: 0 0 0.5rem;
                        border-bottom: 2px dashed #55503f;
                        padding-bottom: 1rem;
                    }

                    p {
                        font-size: 0.9rem;
                        color: #4a4538;
                        margin-bottom: 1rem;
                    }

                    /* Day Block Grid */
                    .day-block {
                        display: grid;
                        grid-template-columns: 70px 1fr;
                        border-top: 1px dashed #55503f;
                        padding-top: 1.5rem;
                        margin-top: 1.5rem;
                        page-break-inside: avoid;
                    }

                    .day-block:first-of-type {
                        border-top: none;
                        padding-top: 0;
                        margin-top: 0;
                    }

                    .day-col-left {
                        display: flex;
                        flex-direction: column;
                        align-items: flex-start;
                    }

                    .day-number {
                        font-family: 'IBM Plex Mono', monospace;
                        font-size: 1.8rem;
                        font-weight: 600;
                        color: #1e8a6e;
                    }

                    .day-label {
                        font-family: 'IBM Plex Mono', monospace;
                        font-size: 0.6rem;
                        color: #8a8375;
                        letter-spacing: 0.1em;
                    }

                    .day-title {
                        font-family: 'Fraunces', serif;
                        font-size: 1.15rem;
                        font-weight: 600;
                        color: #1a1812;
                        margin-bottom: 0.75rem;
                    }

                    /* Route stops list */
                    .route-list {
                        position: relative;
                        padding-left: 1.25rem;
                        margin-top: 0.5rem;
                        margin-bottom: 1rem;
                    }

                    .route-list::before {
                        content: '';
                        position: absolute;
                        left: 4px;
                        top: 5px;
                        bottom: 5px;
                        border-left: 2px dotted #55503f;
                        opacity: 0.4;
                    }

                    .route-stop {
                        position: relative;
                        margin-bottom: 1rem;
                    }

                    .route-stop::before {
                        content: '';
                        position: absolute;
                        left: -19.5px;
                        top: 5px;
                        width: 7px;
                        height: 7px;
                        border-radius: 50%;
                        background-color: #c1442e;
                    }

                    .stop-header {
                        display: flex;
                        align-items: center;
                        gap: 0.5rem;
                    }

                    .stop-time {
                        font-family: 'IBM Plex Mono', monospace;
                        font-size: 0.75rem;
                        color: #8a8375;
                    }

                    .stop-name {
                        font-size: 0.85rem;
                        font-weight: 600;
                        color: #1a1812;
                    }

                    .stop-note {
                        font-size: 0.8rem;
                        color: #55503f;
                        margin-top: 0.15rem;
                    }

                    /* Red bullets for standard lists */
                    ul:not(.checklist) {
                        list-style-type: none;
                        padding-left: 1rem;
                        margin-top: 0.5rem;
                        margin-bottom: 1rem;
                    }

                    ul:not(.checklist) li {
                        position: relative;
                        font-size: 0.85rem;
                        color: #4a4538;
                        margin-bottom: 0.35rem;
                    }

                    ul:not(.checklist) li::before {
                        content: '';
                        position: absolute;
                        left: -0.85rem;
                        top: 0.45rem;
                        width: 5px;
                        height: 5px;
                        border-radius: 50%;
                        background-color: #c1442e;
                    }

                    /* Checklist lists */
                    ul.checklist {
                        list-style-type: none;
                        padding-left: 0.15rem;
                        margin-top: 0.5rem;
                        margin-bottom: 1rem;
                    }

                    ul.checklist li {
                        display: flex;
                        align-items: center;
                        gap: 0.5rem;
                        font-size: 0.85rem;
                        color: #4a4538;
                    }

                    ul.checklist input[type="checkbox"] {
                        width: auto;
                        margin: 0;
                        accent-color: #1e8a6e;
                    }

                    /* Section divider dashed rules */
                    hr {
                        border: none;
                        border-top: 1px dashed #55503f;
                        margin: 1.5rem 0;
                    }

                    h3:not(.day-title) {
                        font-family: 'Fraunces', serif;
                        font-size: 1.15rem;
                        color: #1a1812;
                        border-top: 1px dashed #55503f;
                        padding-top: 1rem;
                        margin-top: 1.5rem;
                        margin-bottom: 0.5rem;
                        page-break-after: avoid;
                    }

                    @media print {
                        body {
                            padding: 0;
                            background-color: #ffffff;
                        }
                    }
                </style>
            </head>
            <body>
                <h1>ITINERARY — ${currentDestination.toUpperCase()}</h1>
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

    // Reset button handler
    resetBtn.addEventListener("click", () => {
        form.reset();
        emptyState.classList.remove("hidden");
        outputContainer.classList.add("hidden");
        postmarkStamp.classList.add("hidden");
        outputContainer.innerHTML = "";
        errorContainer.classList.add("hidden");
        printBtn.disabled = true;
        copyBtn.disabled = true;
        statusText.textContent = "destination · days · budget";
        fullItineraryText = "";
    });

    // Convert day titles into collapsible panels
    function makeSectionsCollapsible() {
        const headers = outputContainer.querySelectorAll(".day-title");
        headers.forEach((header) => {
            header.style.cursor = "pointer";
            const wrapper = header.nextElementSibling;
            
            if (wrapper && wrapper.classList.contains("collapsible-content")) {
                header.addEventListener("click", () => {
                    wrapper.classList.toggle("collapsed");
                    header.classList.toggle("header-collapsed");
                });
            }
        });
    }
});
