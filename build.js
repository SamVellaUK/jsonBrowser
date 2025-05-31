const fs = require('fs');
const path = require('path');
const HTMLMinifier = require('html-minifier-terser');

// Define file paths
const HTML_FILE = 'jsonBrowser.html';
const CSS_FILE = 'basic.css';
const JS_FILE = 'basic.js'; // Make sure this file has the corrected highlightText function
const JSON_DATA_FILE = 'samplejson.json';
const OUTPUT_FILE = 'dist/index.html'; // Output directory and file

// Ensure dist directory exists
const distDir = path.dirname(OUTPUT_FILE);
if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir, { recursive: true });
}

// Wrap the main logic in an async function
async function build() {
    try {
        // 1. Read all file contents
        let htmlContent = fs.readFileSync(HTML_FILE, 'utf-8');
        const cssContent = fs.readFileSync(CSS_FILE, 'utf-8');
        let jsContent = fs.readFileSync(JS_FILE, 'utf-8');
        const jsonDataContent = fs.readFileSync(JSON_DATA_FILE, 'utf-8');

        // 2. Prepare jsonData to be embedded
        const jsonDataScript = `<script>const jsonData = ${JSON.stringify(JSON.parse(jsonDataContent))};</script>`;

        // 3. Inline CSS
        htmlContent = htmlContent.replace(
            /<link rel="stylesheet" href="basic.css" \/>/g,
            `<style>${cssContent}</style>`
        );

        // 4. Safety: Escape </script> within the JS content itself.
        //    While the main issue was in query.replace, this is still good practice.
        jsContent = jsContent.replace(/<\/script>/gi, '<\\/script>');

        // 5. Inline JS and embed JSON data
        htmlContent = htmlContent.replace(
            /<script type="module" src="basic.js"><\/script>/g,
            `${jsonDataScript}\n  <script type="module">${jsContent}<\/script>`
        );

        // 6. Minify the combined HTML
        const minifierOptions = {
            collapseBooleanAttributes: true,
            collapseWhitespace: true,
            conservativeCollapse: false,
            decodeEntities: true,
            html5: true,
            minifyCSS: true,
            minifyJS: true, // Attempt full JS minification now
            processConditionalComments: true,
            removeAttributeQuotes: true,
            removeComments: true,
            removeEmptyAttributes: true,
            removeOptionalTags: true,
            removeRedundantAttributes: true,
            removeScriptTypeAttributes: true,
            removeStyleLinkTypeAttributes: true,
            removeTagWhitespace: false,
            sortAttributes: true,
            sortClassName: true,
            trimCustomFragments: true,
            useShortDoctype: true,
        };

        const minifiedHtml = await HTMLMinifier.minify(htmlContent, minifierOptions);

        // 7. Write the output file
        fs.writeFileSync(OUTPUT_FILE, minifiedHtml, 'utf-8');
        console.log(`Successfully created minimized file: ${OUTPUT_FILE}`);

    } catch (error) {
        console.error('Error during build process:');
        console.error(error.message || error);

        if (typeof error === 'object' && error !== null) {
            const errorDetails = {...error};
            delete errorDetails.message;
            if (Object.keys(errorDetails).length > 0) {
                 console.error("Full error object details:", errorDetails);
            }
        }
        if (error.stdout) console.error("Minifier stdout:", error.stdout);
        if (error.stderr) console.error("Minifier stderr:", error.stderr);
    }
}

// Call the async function
build();