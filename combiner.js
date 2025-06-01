// combiner.js
const fs = require('fs').promises;
const path = require('path');

async function combineFiles() {
    try {
        const scriptDir = __dirname;

        const htmlFilePath = path.join(scriptDir, 'jsonBrowser.html');
        const cssFilePath = path.join(scriptDir, 'basic.css');
        
        const sqlGenFilePath = path.join(scriptDir, 'sqlGenerator.js');
        const stateJsFilePath = path.join(scriptDir, 'state.js');
        const utilsJsFilePath = path.join(scriptDir, 'utils.js');
        const uiJsFilePath = path.join(scriptDir, 'ui.js');
        const entryPointJsFilePath = path.join(scriptDir, 'basic.js');

        const outputFilePath = path.join(scriptDir, 'jsonBrowser_standalone.html');

        let htmlContent = await fs.readFile(htmlFilePath, 'utf8');
        const cssContent = await fs.readFile(cssFilePath, 'utf8');
        
        let sqlGenContent = await fs.readFile(sqlGenFilePath, 'utf8');
        let stateJsContent = await fs.readFile(stateJsFilePath, 'utf8');
        let utilsJsContent = await fs.readFile(utilsJsFilePath, 'utf8');
        let uiJsContent = await fs.readFile(uiJsFilePath, 'utf8');
        let entryPointJsContent = await fs.readFile(entryPointJsFilePath, 'utf8');

        // Function to remove import and export statements
        const stripModules = (content) => {
            // Remove import statements: import ... from './module.js';
            content = content.replace(/import\s+.*?from\s*['"].*?['"];?\s*/gs, '');
            // Remove export { ... };
            content = content.replace(/export\s*{\s*[\s\S]*?\s*};?\s*/gs, '');
            // Remove export default ...;
            content = content.replace(/export\s+default\s+/gs, '');
            // Remove export (const|let|var|function|class) ... and keep the declaration
            content = content.replace(/export\s+(?=const|let|var|function|class)/g, '');
            return content;
        };

        // Strip module syntax from all JS files
        sqlGenContent = stripModules(sqlGenContent);
        stateJsContent = stripModules(stateJsContent);
        utilsJsContent = stripModules(utilsJsContent);
        uiJsContent = stripModules(uiJsContent);
        entryPointJsContent = stripModules(entryPointJsContent);
        
        const combinedJsContent = `
// --- START OF INLINED sqlGenerator.js ---
${sqlGenContent}
// --- END OF INLINED sqlGenerator.js ---

// --- START OF INLINED state.js ---
${stateJsContent}
// --- END OF INLINED state.js ---

// --- START OF INLINED utils.js ---
${utilsJsContent}
// --- END OF INLINED utils.js ---

// --- START OF INLINED ui.js ---
${uiJsContent}
// --- END OF INLINED ui.js ---

// --- START OF INLINED basic.js (entry point) ---
${entryPointJsContent}
// --- END OF INLINED basic.js (entry point) ---
`;

        htmlContent = htmlContent.replace(
            /<link\s+rel="stylesheet"\s+href="basic\.css"\s*\/?>/i,
            `<style>\n${cssContent}\n</style>`
        );

        htmlContent = htmlContent.replace(
            // Match the script tag that loads basic.js (your entry point for development)
            /<script\s+type="module"\s+src="basic\.js"\s*><\/script>/i,
            () => `<script type="module">\n${combinedJsContent}\n</script>`
        );
        // If your HTML directly loads other JS files during development, you'd remove those too.
        // For now, assuming only basic.js is the entry point in the HTML.

        await fs.writeFile(outputFilePath, htmlContent, 'utf8');
        console.log(`Successfully created ${outputFilePath}`);

    } catch (error) {
        console.error('Error combining files:', error);
    }
}

combineFiles();