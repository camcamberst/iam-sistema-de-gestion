const fs = require('fs');
const path = require('path');

function walk(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(file => {
        file = path.join(dir, file);
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) {
            results = results.concat(walk(file));
        } else if (file.endsWith('.tsx') && !file.includes('.backup')) {
            results.push(file);
        }
    });
    return results;
}

const files = walk('./app/admin');
let changedFiles = 0;

files.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');
    
    // Add 's' flag so that .*? matches newlines!
    
    // Pattern 1: Wrapped in max-w-screen
    const regex1 = /<div className="max-w-[^>]+>\s*<div className="bg-white\/80 dark:bg-gray-700\/80 backdrop-blur-sm rounded-[^>]+ text-center">\s*(?:<div className="flex justify-center">\s*)?<div className="animate-spin[^>]+><\/div>(?:\s*<\/div>)?\s*<p className="[^>]+>(.*?)<\/p>\s*<\/div>\s*<\/div>/gs;

    // Pattern 2: Standalone gray box
    const regex2 = /<div className="bg-white\/80 dark:bg-gray-700\/80 backdrop-blur-sm rounded-[^>]+ text-center">\s*(?:<div className="flex justify-center">\s*)?<div className="animate-spin[^>]+><\/div>(?:\s*<\/div>)?\s*<p className="[^>]+>(.*?)<\/p>\s*<\/div>/gs;

    let newContent = content.replace(regex1, `<div className="flex flex-col items-center justify-center min-h-[40vh] py-16 text-center">\n\t\t\t\t<div className="animate-spin w-8 h-8 border-2 border-indigo-500/80 border-t-transparent rounded-full mx-auto mb-4"></div>\n\t\t\t\t<p className="text-sm font-medium text-gray-500 dark:text-gray-400 tracking-wide">$1</p>\n\t\t\t</div>`);
    
    newContent = newContent.replace(regex2, `<div className="flex flex-col items-center justify-center min-h-[40vh] py-16 text-center">\n\t\t\t\t<div className="animate-spin w-8 h-8 border-2 border-indigo-500/80 border-t-transparent rounded-full mx-auto mb-4"></div>\n\t\t\t\t<p className="text-sm font-medium text-gray-500 dark:text-gray-400 tracking-wide">$1</p>\n\t\t\t</div>`);

    // Let's also fix the error red boxes
    const errorRegex1 = /<div className="max-w-[^>]+>\s*<div className="bg-white\/80 dark:bg-gray-700\/80 backdrop-blur-sm rounded-[^>]+ text-center">\s*<div className="w-12 h-12 bg-red-50 dark:bg-red-900\/20 rounded-full flex items-center justify-center mx-auto mb-4">\s*<svg className="w-6 h-6 text-red-500 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">\s*<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={?["']?2["']?} d="M12 9v2m0 4h\.01m-6\.938 4h13\.856c1\.54 0 2\.502-1\.667 1\.732-3L13\.732 4c-\.77-1\.333-2\.694-1\.333-3\.464 0L3\.34 16c-\.77 1\.333\.192 3 1\.732 3z" \/>\s*<\/svg>\s*<\/div>\s*<h[23] className="text-lg font-[^>]+ mb-2">(.*?)<\/h[23]>\s*<p className="text-sm text-gray-600 dark:text-gray-300(?: mb-6)?">(.*?)<\/p>(?:\s*<button[^>]+>.*?<\/button>)?\s*<\/div>\s*<\/div>/gs;

    newContent = newContent.replace(errorRegex1, `<div className="flex flex-col items-center justify-center min-h-[40vh] text-center py-16">\n\t\t\t\t<div className="w-12 h-12 bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-4">\n\t\t\t\t\t<svg className="w-6 h-6 text-red-500 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">\n\t\t\t\t\t\t<path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />\n\t\t\t\t\t</svg>\n\t\t\t\t</div>\n\t\t\t\t<h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">$1</h3>\n\t\t\t\t<p className="text-sm text-gray-600 dark:text-gray-400">$2</p>\n\t\t\t</div>`);

    if (newContent !== content) {
        fs.writeFileSync(file, newContent, 'utf8');
        console.log('Modified:', file);
        changedFiles++;
    }
});

console.log('Total files modified:', changedFiles);
