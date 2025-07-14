// chzzk_grouper/popup.js (수정된 버전)

document.addEventListener('DOMContentLoaded', () => {
    const optionsContainer = document.getElementById('options-container');

    const menuOptions = [
        { name: '추천 채널' },
        { name: '파트너 스트리머' },
        { name: '서비스 바로가기' }
    ];

    chrome.storage.sync.get('hiddenMenus', (data) => {
        // 이 코드는 팝업이 닫힌 후에 실행될 수 있습니다.
        // 그 경우 chrome.runtime.lastError에 오류가 기록됩니다.
        if (chrome.runtime.lastError) {
            // 팝업이 닫혀서 발생하는 자연스러운 오류이므로,
            // 콘솔에 경고만 남기고 함수를 조용히 종료합니다.
            console.warn("Popup was closed before the settings could be loaded.");
            return;
        }

        const hiddenMenus = data.hiddenMenus || [];
        
        menuOptions.forEach(option => {
            const isHidden = hiddenMenus.includes(option.name);

            const optionItem = document.createElement('div');
            optionItem.className = 'option-item';
            optionItem.innerHTML = `
                <span>${option.name} 끄기</span>
                <label class="switch">
                    <input type="checkbox" data-menu-name="${option.name}" ${isHidden ? 'checked' : ''}>
                    <span class="slider"></span>
                </label>
            `;
            optionsContainer.appendChild(optionItem);

            const checkbox = optionItem.querySelector('input');
            checkbox.addEventListener('change', (event) => {
                const updatedHiddenMenus = [];
                document.querySelectorAll('input[type="checkbox"]').forEach(cb => {
                    const menuName = cb.dataset.menuName;
                    if (cb.checked) {
                        updatedHiddenMenus.push(menuName);
                    }
                });
                
                // 데이터를 저장할 때도 같은 오류가 발생할 수 있으므로 확인 로직을 추가합니다.
                chrome.storage.sync.set({ hiddenMenus: updatedHiddenMenus }, () => {
                    if (chrome.runtime.lastError) {
                        console.warn("Popup was closed before settings could be saved.");
                        return;
                    }
                    console.log(`Hidden menus updated: ${updatedHiddenMenus}`);
                });
            });
        });
    });
});