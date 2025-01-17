// 创建一个异步函数来获取设置
async function getSettings() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(
      ['sourceLanguage', 'targetLanguage', 'apiKey', 'modelType'],
      function(result) {
        resolve({
          sourceLanguage: result.sourceLanguage || 'auto',
          targetLanguage: result.targetLanguage || 'en',
          apiKey: result.apiKey || '',
          modelType: result.modelType || 'chatgpt'
        });
      }
    );
  });
}

// 确保在使用设置之前已经获取到值
let settings = {};
let isSettingsLoaded = false;

// 初始化设置
async function initSettings() {
  settings = await new Promise((resolve) => {
    chrome.storage.sync.get(
      ['sourceLanguage', 'targetLanguage', 'encryptedApiKey', 'modelType', 'autoTranslate'],
      function(result) {
        resolve({
          sourceLanguage: result.sourceLanguage || 'auto',
          targetLanguage: result.targetLanguage || 'en',
          modelType: result.modelType || 'google',
          encryptedApiKey: result.encryptedApiKey,
          autoTranslate: result.autoTranslate === undefined ? true : result.autoTranslate
        });
      }
    );
  });
  
  isSettingsLoaded = true;
}

// 监听设置变化
chrome.storage.onChanged.addListener(function(changes) {
  for (let key in changes) {
    settings[key] = changes[key].newValue;
  }
});

// 添加防抖函数
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// 修改 observer 的处理逻辑
const handleMutations = async function(mutations) {
  if (!isSettingsLoaded) {
    await initSettings();
  }

  // 检查自动翻译开关
  if (!settings.autoTranslate) {
    return;
  }

  // 更精确的选择器，针对笔记主内容
  const noteContent = document.querySelector('.note-content:not([data-translated])');
  const noteDesc = document.querySelector('.note-desc:not([data-translated])');
  
  // 处理笔记主内容
  if (noteContent) {
    noteContent.setAttribute('data-translated', 'processing');
    await translateElement(noteContent);
  }

  // 处理笔记描述
  if (noteDesc) {
    noteDesc.setAttribute('data-translated', 'processing');
    await translateElement(noteDesc);
  }
  
  // 处理评论（保持原有逻辑）
  const comments = document.querySelectorAll('.comment-item .content:not([data-translated])');
  comments.forEach(async (comment) => {
    const parentComment = comment.closest('.comment-item');
    const existingTranslation = parentComment.querySelector('.translated-content');
    
    if (!existingTranslation) {
      comment.setAttribute('data-translated', 'processing');
      await translateElement(comment);
    }
  });
};

// 使用防抖包装处理函数
const debouncedHandleMutations = debounce(handleMutations, 500);

// 创建观察器
const observer = new MutationObserver((mutations) => {
  const relevantMutations = mutations.filter(mutation => {
    const target = mutation.target;
    return !target.classList.contains('translated-content') &&
           !target.hasAttribute('data-translated') &&
           !target.closest('.translated-content');
  });

  if (relevantMutations.length > 0) {
    debouncedHandleMutations(relevantMutations);
  }
});

// 修改 translateElement 函数
async function translateElement(element) {
  try {
    if (element.querySelector('.translated-content')) {
      return;
    }

    const originalText = element.innerText;
    const translatedText = await translateWithAPI(originalText);
    
    const translatedDiv = document.createElement('div');
    translatedDiv.className = 'translated-content';
    translatedDiv.innerText = translatedText;
    
    // 根据不同元素类型选择不同的插入位置
    if (element.classList.contains('note-content') || element.classList.contains('note-desc')) {
      // 笔记主内容和描述：直接插入到原元素后面
      element.appendChild(translatedDiv);
    } else if (element.closest('.comment-item')) {
      // 评论：插入到评论内容后面
      const parent = element.closest('.comment-item');
      const contentElement = parent.querySelector('.content');
      contentElement.appendChild(translatedDiv);
    }
    
    element.setAttribute('data-translated', 'completed');
  } catch (error) {
    console.error('翻译失败:', error);
    element.removeAttribute('data-translated');
  }
}

// 可以尝试更精确地指定观察目标
const commentContainer = document.querySelector('.comment-list');
if (commentContainer) {
  observer.observe(commentContainer, {
    childList: true,
    subtree: true,
    attributes: false,
    characterData: false
  });
} else {
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: false,
    characterData: false
  });
}

async function translateWithAPI(text) {
  if (!isSettingsLoaded) {
    await initSettings();
  }

  try {
    const storedSettings = await new Promise((resolve) => {
      chrome.storage.sync.get(
        ['sourceLanguage', 'targetLanguage', 'encryptedApiKey', 'modelType'],
        (result) => resolve(result)
      );
    });

    const response = await chrome.runtime.sendMessage({
      type: 'translate',
      text: text,
      settings: {
        sourceLanguage: settings.sourceLanguage,
        targetLanguage: settings.targetLanguage,
        modelType: settings.modelType,
        encryptedApiKey: storedSettings.encryptedApiKey
      }
    });

    if (!response.success) {
      throw new Error(response.error);
    }

    return response.data;
  } catch (error) {
    throw error;
  }
}

// 初始化设置
initSettings();
