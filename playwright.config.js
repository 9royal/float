import {defineConfig} from '@playwright/test';
import {existsSync} from 'node:fs';

const chrome=process.env.CHROME_PATH||['C:/Program Files/Google/Chrome/Application/chrome.exe','/usr/bin/google-chrome','/usr/bin/chromium'].find(existsSync);
export default defineConfig({
  testDir:'./tests/e2e',timeout:45000,expect:{timeout:10000},workers:1,retries:0,
  reporter:[['list'],['json',{outputFile:'test-results/results.json'}]],
  use:{baseURL:process.env.BASE_URL||'http://127.0.0.1:4178',viewport:{width:1440,height:900},headless:true,
    launchOptions:{...(chrome?{executablePath:chrome}:{}),args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']},
    screenshot:'only-on-failure',trace:'retain-on-failure'},
  webServer:process.env.BASE_URL?undefined:{command:'node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 4178 --strictPort',url:'http://127.0.0.1:4178',reuseExistingServer:!process.env.CI,timeout:30000}
});
