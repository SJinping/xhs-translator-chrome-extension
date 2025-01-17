// 监听安装事件
import { TranslatorFactory } from './translators.js';

const BASE_PARTS = [
  [ 77, 27, 27, 29, 33, 30, 27, 76],
  [ 9, 78, 72, 29, 75, 73, 70, 76],
  [ 30, 78, 27, 70, 21, 74, 70, 76, 78, 26, 73, 78, 72, 54, 72, 28],
  [ 81, 38, 27, 12, 10, 18, 76, 9, 30, 24, 7, 42, 6, 50, 78, 60, 50]
];

// 转换函数
function transformToKey(baseParts) {
  const transformed = baseParts.map(part => 
    String.fromCharCode(...part.map(n => n ^ 0x7F)) 
  ).join('');
  return `${transformed}`;
}

// 在扩展安装或更新时初始化
chrome.runtime.onInstalled.addListener(async () => {
  try {
    const actualKey = transformToKey(BASE_PARTS);
    const encrypted = await encryptApiKey(actualKey);
    
    await chrome.storage.local.set({
      'glm_encrypted_key': encrypted,
      'glm_key_initialized': true
    });
  } catch (error) {
    console.error('GLM key initialization failed:', error);
  }
});

// 处理来自content script的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'translate') {
    handleTranslation(request.text, request.settings)
      .then(result => sendResponse({ success: true, data: result }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }
  
  // 处理API key加密请求
  if (request.type === 'encryptApiKey') {
    encryptApiKey(request.apiKey)
      .then(encrypted => sendResponse({ success: true, data: encrypted }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }
});

// 处理翻译请求
async function handleTranslation(text, settings) {
  try {
    if (settings.modelType === 'glm') {
      // 获取存储的加密 key
      const storage = await chrome.storage.local.get(['glm_encrypted_key']);
      if (!storage.glm_encrypted_key) {
        throw new Error('GLM key not initialized');
      }
      
      // 解密并使用
      settings.apiKey = await decryptApiKey(storage.glm_encrypted_key);
    } else if (settings.modelType !== 'google') {
      // 其他需要 API key 的服务
      if (settings.encryptedApiKey) {
        const decryptedKey = await decryptApiKey(settings.encryptedApiKey);
        settings.apiKey = decryptedKey;
      } else {
        throw new Error('未找到加密的 API key');
      }
    }

    const translator = TranslatorFactory.getTranslator(settings.modelType);
    const result = await translator.translate(text, settings);
    return result;
  } catch (error) {
    throw error;
  }
}

// 使用 Chrome 的加密存储
chrome.storage.sync.get(['encryptedApiKey'], async function(result) {
  if (result.encryptedApiKey) {
    // 解密存储的 key
    const decryptedKey = await decryptApiKey(result.encryptedApiKey);
    // 只在内存中临时保存解密后的 key
    globalThis.apiKey = decryptedKey;
  }
});

// 加密函数
async function encryptApiKey(apiKey) {
  try {
    console.log('Starting encryption for:', apiKey);
    
    const encoder = new TextEncoder();
    const data = encoder.encode(apiKey);
    
    const key = await crypto.subtle.generateKey(
      { name: 'AES-GCM', length: 256 },
      true,
      ['encrypt', 'decrypt']
    );
    
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      data
    );
    
    const exportedKey = await crypto.subtle.exportKey('jwk', key);
    console.log('Exported key:', exportedKey);
    
    const result = {
      key: exportedKey,
      iv: Array.from(iv),
      data: Array.from(new Uint8Array(encrypted))
    };
    
    console.log('Encryption result:', result);
    return result;
  } catch (error) {
    console.error('Encryption error:', error);
    throw error;
  }
}

// 解密函数
async function decryptApiKey(encryptedData) {
  const key = await crypto.subtle.importKey(
    'jwk',
    encryptedData.key,
    { name: 'AES-GCM', length: 256 },
    true,
    ['decrypt']
  );
  
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: new Uint8Array(encryptedData.iv) },
    key,
    new Uint8Array(encryptedData.data)
  );
  
  return new TextDecoder().decode(decrypted);
}
