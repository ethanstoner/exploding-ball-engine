// Record demo GIF using Puppeteer
const puppeteer = require('puppeteer');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

async function recordDemo() {
    console.log('Starting browser...');
    // Try Linux Chromium first, fallback to Windows Chrome
    let executablePath = '/usr/bin/chromium-browser';
    let args = ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'];
    
    if (!require('fs').existsSync(executablePath)) {
        executablePath = '/mnt/c/Program Files/Google/Chrome/Application/chrome.exe';
        args = ['--no-sandbox'];
    }
    
    const browser = await puppeteer.launch({
        headless: true,
        executablePath: executablePath,
        args: args
    });
    
    const page = await browser.newPage();
    // Set larger viewport to capture full page including bottom
    await page.setViewport({ width: 1200, height: 1100 });
    
    console.log('Loading simulation...');
    await page.goto('http://localhost:8000', { waitUntil: 'networkidle0' });
    await new Promise(resolve => setTimeout(resolve, 1500)); // Wait for full render
    
    // Create frames directory
    const framesDir = path.join(__dirname, 'demo_frames');
    if (!fs.existsSync(framesDir)) {
        fs.mkdirSync(framesDir);
    }
    
    // Clean up old frames
    const oldFrames = fs.readdirSync(framesDir).filter(f => f.endsWith('.png'));
    oldFrames.forEach(f => fs.unlinkSync(path.join(framesDir, f)));
    
    // Get full page dimensions
    const fullPageHeight = await page.evaluate(() => {
        return Math.max(
            document.body.scrollHeight,
            document.body.offsetHeight,
            document.documentElement.clientHeight,
            document.documentElement.scrollHeight,
            document.documentElement.offsetHeight
        );
    });
    
    console.log(`Full page height: ${fullPageHeight}px`);
    
    // Take initial frame with full page
    await page.screenshot({ 
        path: path.join(framesDir, 'frame_000.png'),
        fullPage: true 
    });
    
    console.log('Launching ball...');
    await page.click('#launchBtn');
    
    // Record frames for 8 seconds at 60 fps for smooth animation
    const fps = 60;
    const durationSeconds = 8;
    const frameCount = fps * durationSeconds; // 480 frames for 8 seconds
    
    console.log(`Recording ${frameCount} frames at ${fps} fps...`);
    
    for (let i = 1; i <= frameCount; i++) {
        await new Promise(resolve => setTimeout(resolve, 1000 / fps)); // 60 fps
        await page.screenshot({ 
            path: path.join(framesDir, `frame_${String(i).padStart(4, '0')}.png`),
            fullPage: true 
        });
        if (i % 60 === 0) {
            console.log(`Recorded ${i}/${frameCount} frames (${Math.round(i/fps)}s)...`);
        }
    }
    
    await browser.close();
    
    // Convert to GIF using ffmpeg with high quality settings
    console.log('Creating high-quality GIF...');
    // Use 60 fps, better palette, and optimize for quality
    const ffmpegCmd = `ffmpeg -y -framerate ${fps} -i ${framesDir}/frame_%04d.png -vf "scale=1200:-1:flags=lanczos,split[s0][s1];[s0]palettegen=reserve_transparent=0:stats_mode=single[p];[s1][p]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle" -loop 0 demo.gif`;
    
    try {
        execSync(ffmpegCmd, { stdio: 'inherit' });
        console.log('✓ GIF created successfully: demo.gif');
        
        // Clean up frames
        const frames = fs.readdirSync(framesDir).filter(f => f.endsWith('.png'));
        frames.forEach(f => fs.unlinkSync(path.join(framesDir, f)));
        fs.rmdirSync(framesDir);
        
        return 'demo.gif';
    } catch (error) {
        console.error('Error creating GIF:', error.message);
        console.log('Frames saved in', framesDir, 'directory');
        return null;
    }
}

recordDemo().then(result => {
    if (result) {
        console.log(`\nDemo GIF ready: ${result}`);
    }
    process.exit(result ? 0 : 1);
}).catch(error => {
    console.error('Error:', error);
    process.exit(1);
});
