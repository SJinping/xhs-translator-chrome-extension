document.addEventListener('DOMContentLoaded', function() {
  // 加载已保存的设置
  chrome.storage.sync.get(
    ['sourceLanguage', 'targetLanguage', 'encryptedApiKey', 'modelType', 'autoTranslate'], 
    function(result) {
      if (result.sourceLanguage) {
        document.getElementById('sourceLanguage').value = result.sourceLanguage;
      }
      if (result.targetLanguage) {
        document.getElementById('targetLanguage').value = result.targetLanguage;
      }
      if (result.modelType) {
        document.getElementById('modelType').value = result.modelType;
      }
      
      // 设置自动翻译开关的默认状态为开启
      document.getElementById('autoTranslate').checked = 
        result.autoTranslate === undefined ? true : result.autoTranslate;
      
      // 根据当前选择的模型控制 API Key 输入框
      toggleApiKeyInput(document.getElementById('modelType').value);
    }
  );

  // API Key 输入框显示控制
  function toggleApiKeyInput(modelType) {
    const apiKeyInput = document.getElementById('apiKey');
    const apiKeyContainer = document.getElementById('apiKeyContainer');
    
    // Google 翻译和 GLM 都不需要显示 API key 输入框
    if (modelType === 'google' || modelType === 'glm') {
      apiKeyContainer.style.display = 'none';
      apiKeyInput.disabled = true;
      apiKeyInput.value = '';
    } else {
      apiKeyContainer.style.display = 'block';
      apiKeyInput.disabled = false;
    }
  }

  // 监听翻译模型选择变化
  document.getElementById('modelType').addEventListener('change', function(e) {
    toggleApiKeyInput(e.target.value);
  });

  // 保存设置
  document.getElementById('saveSettings').addEventListener('click', async function() {
    try {
      const modelType = document.getElementById('modelType').value;
      const settings = {
        sourceLanguage: document.getElementById('sourceLanguage').value,
        targetLanguage: document.getElementById('targetLanguage').value,
        modelType: modelType,
        autoTranslate: document.getElementById('autoTranslate').checked
      };

      // 只有非 Google 和非 GLM 时才保存 API Key
      if (modelType !== 'google' && modelType !== 'glm') {
        const apiKey = document.getElementById('apiKey').value;
        if (!apiKey) {
          throw new Error('请输入 API Key');
        }
        if (!apiKey.startsWith('sk-')) {
          throw new Error('API Key 必须以 sk- 开头');
        }

        const encryptResponse = await chrome.runtime.sendMessage({
          type: 'encryptApiKey',
          apiKey: apiKey
        });

        if (!encryptResponse.success || !encryptResponse.data) {
          throw new Error('API Key 加密失败');
        }

        settings.encryptedApiKey = encryptResponse.data;
      }

      await new Promise((resolve, reject) => {
        chrome.storage.sync.set(settings, () => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else {
            resolve();
          }
        });
      });

      alert('设置已保存！');
    } catch (error) {
      alert(error.message);
    }
  });
}); 
