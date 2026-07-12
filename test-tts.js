import WebSocket from "ws";

const wsUrlBase = "wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/bootstrap?trustedclienttoken=6A5AA1D4EAFF4E9B87E23D3C28447D66";

async function testConnection(name, useConnectionId, customHeaders) {
  return new Promise((resolve) => {
    const requestId = Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join("");
    const url = useConnectionId ? `${wsUrlBase}&ConnectionId=${requestId}` : wsUrlBase;
    
    console.log(`[Test: ${name}] Connecting to: ${url.substring(0, 100)}...`);
    const options = {};
    if (customHeaders) {
      options.headers = customHeaders;
    }
    
    const ws = new WebSocket(url, options);
    
    let resolved = false;
    
    ws.on("open", () => {
      console.log(`[Test: ${name}] SUCCESS: Connection opened successfully!`);
      resolved = true;
      ws.close();
      resolve(true);
    });
    
    ws.on("error", (err) => {
      console.log(`[Test: ${name}] FAILED: ${err.message}`);
      resolved = true;
      resolve(false);
    });
    
    setTimeout(() => {
      if (!resolved) {
        console.log(`[Test: ${name}] TIMEOUT`);
        ws.close();
        resolve(false);
      }
    }, 5000);
  });
}

async function runAll() {
  console.log("Starting handshake diagnostic tests...");
  
  // Test 1: Standard Python edge-tts headers + ConnectionId
  await testConnection("Python edge-tts standards + ConnectionId", true, {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0",
    "Origin": "chrome-extension://jdgocmbbgmapmcaocgilaenmcoicgclj"
  });

  // Test 2: Standard Python edge-tts headers without ConnectionId
  await testConnection("Python edge-tts standards without ConnectionId", false, {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0",
    "Origin": "chrome-extension://jdgocmbbgmapmcaocgilaenmcoicgclj"
  });

  // Test 3: No custom headers, with ConnectionId
  await testConnection("No headers + ConnectionId", true, null);

  // Test 4: No custom headers, without ConnectionId
  await testConnection("No headers without ConnectionId", false, null);

  // Test 5: Only User-Agent, with ConnectionId
  await testConnection("Only User-Agent + ConnectionId", true, {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
  });

  // Test 6: Custom Origin, with ConnectionId
  await testConnection("Custom Origin (Edge) + ConnectionId", true, {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0",
    "Origin": "https://www.bing.com"
  });
}

runAll();
