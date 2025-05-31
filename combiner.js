// combiner.js
const fs = require('fs').promises;
const path = require('path');

async function combineFiles() {
    try {
        const scriptDir = __dirname; // Assumes script is in the same dir as source files

        // Define file paths
        const htmlFilePath = path.join(scriptDir, 'jsonBrowser.html');
        const cssFilePath = path.join(scriptDir, 'basic.css');
        const sqlGenFilePath = path.join(scriptDir, 'sqlGenerator.js');
        const basicJsFilePath = path.join(scriptDir, 'basic.js');
        const outputFilePath = path.join(scriptDir, 'jsonBrowser_standalone.html');

        // Read file contents
        let htmlContent = await fs.readFile(htmlFilePath, 'utf8');
        const cssContent = await fs.readFile(cssFilePath, 'utf8');
        const sqlGenContent = await fs.readFile(sqlGenFilePath, 'utf8');
        let basicJsContent = await fs.readFile(basicJsFilePath, 'utf8');

        // 1. Prepare combined JavaScript
        // Remove the import statement from basic.js (uses backreference \1 for matching quotes)
        basicJsContent = basicJsContent.replace(
            /import\s*{\s*generateSQL\s*}\s*from\s*(['"])\.\/sqlGenerator\.js\1;?\s*/g,
            ''
        );
        
        // Combine sqlGenerator.js and modified basic.js
        const combinedJsContent = `
// --- START OF INLINED sqlGenerator.js ---
${sqlGenContent}
// --- END OF INLINED sqlGenerator.js ---

// --- START OF INLINED basic.js (with import removed) ---
${basicJsContent}
// --- END OF INLINED basic.js ---
`;

        // 2. Inject CSS into HTML
        // Replaces: <link rel="stylesheet" href="basic.css" />
        htmlContent = htmlContent.replace(
            /<link\s+rel="stylesheet"\s+href="basic\.css"\s*\/?>/i,
            `<style>\n${cssContent}\n</style>`
        );

        // 3. Inject combined JavaScript into HTML
        // Replaces: <script type="module" src="basic.js"></script>
        // Use a replacer function to prevent special characters in combinedJsContent
        // (like $&) from being interpreted by the outer .replace()
        htmlContent = htmlContent.replace(
            /<script\s+type="module"\s+src="basic\.js"\s*><\/script>/i,
            () => `<script type="module">\n${combinedJsContent}\n</script>`
        );

        // 4. Write the output file
        await fs.writeFile(outputFilePath, htmlContent, 'utf8');
        console.log(`Successfully created ${outputFilePath}`);

    } catch (error) {
        console.error('Error combining files:', error);
    }
}

combineFiles();