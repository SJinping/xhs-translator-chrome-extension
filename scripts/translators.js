class TranslatorFactory {
    static getTranslator(type) {
      switch (type.toLowerCase()) {
        case 'chatgpt':
          return new ChatGPTTranslator();
        case 'deepseek':
          return new DeepSeekTranslator();
        case 'google':
          return new GoogleTranslator();
        case 'glm':
          return new GLMTranslator();
        default:
          throw new Error(`Unsupported translator type: ${type}`);
      }
    }
  }
  
  class BaseTranslator {
    constructor() {
      if (this.constructor === BaseTranslator) {
        throw new Error('Cannot instantiate abstract class');
      }
    }
  
    async translate(text, settings) {
      return chrome.runtime.sendMessage({
        type: 'translate',
        text,
        model: this.constructor.name,
        settings: {
          sourceLanguage: settings.sourceLanguage,
          targetLanguage: settings.targetLanguage
        }
      });
    }
  
    async handleApiError(error, service) {
      if (error.message.includes('Authentica')) {
        // throw new Error(`${service} API密钥无效或已过期，请检查设置`);
        throw new Error(`${service}翻译服务错误: ${error.message}`);
      }
      throw new Error(`${service}翻译服务错误: ${error.message}`);
    }
  }
  
  class ChatGPTTranslator extends BaseTranslator {
    async translate(text, settings) {
      try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${settings.apiKey}`
          },
          body: JSON.stringify({
            model: "gpt-3.5-turbo",
            messages: [{
              role: "user",
              content: `Translate the following text from ${settings.sourceLanguage} to ${settings.targetLanguage}: ${text}`
            }]
          })
        });
  
        if (!response.ok) {
          const errorData = await response.text();
          throw new Error(errorData);
        }
  
        const data = await response.json();
        return data.choices[0].message.content;
      } catch (error) {
        return this.handleApiError(error, 'ChatGPT');
      }
    }
  }
  
  class DeepSeekTranslator extends BaseTranslator {
    async translate(text, settings) {
      try {
        const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${settings.apiKey}`,
            'Accept': 'application/json'
          },
          body: JSON.stringify({
            model: "deepseek-chat",
            messages: [{
              role: "user",
              content: `Translate the following text from ${settings.sourceLanguage} to ${settings.targetLanguage}: ${text}`
            }],
            temperature: 0.3,
            max_tokens: 2000
          })
        });
  
        if (!response.ok) {
          const errorData = await response.text();
          throw new Error(errorData);
        }
  
        const data = await response.json();
        return data.choices[0].message.content;
      } catch (error) {
        return this.handleApiError(error, 'DeepSeek');
      }
    }
  }
  
  class GoogleTranslator extends BaseTranslator {
    async translate(text, settings) {
      try {
        const sourceLang = settings.sourceLanguage === 'auto' ? 'auto' : settings.sourceLanguage;
        const targetLang = settings.targetLanguage;
        
        const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sourceLang}&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`;
        
        const response = await fetch(url);
        
        if (!response.ok) {
          throw new Error('Google翻译服务暂时不可用');
        }

        const data = await response.json();
        
        if (!data || !data[0]) {
          throw new Error('翻译结果格式错误');
        }

        return data[0]
          .filter(item => item[0])
          .map(item => item[0])
          .join('');
      } catch (error) {
        return this.handleApiError(error, 'Google');
      }
    }
  }
  
  class GLMTranslator extends BaseTranslator {
    async translate(text, settings) {
      try {
        const response = await fetch('https://open.bigmodel.cn/api/paas/v4/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': settings.apiKey
          },
          body: JSON.stringify({
            model: "glm-4v-flash",
            messages: [{
              role: "user",
              content: `Translate the following text from ${settings.sourceLanguage} to ${settings.targetLanguage}: ${text}`
            }]
          })
        });

        if (!response.ok) {
          const errorData = await response.text();
          console.error('GLM API Error:', errorData);
          throw new Error(errorData);
        }

        const data = await response.json();
        return data.choices[0].message.content;
      } catch (error) {
        console.error('GLM Translation Error:', error);
        return this.handleApiError(error, 'GLM');
      }
    }
  }
  
  export { TranslatorFactory };
