document.addEventListener('DOMContentLoaded', () => {
    const optionsContainer = document.getElementById('options-container');
    const menuOptions = [
        { name: '추천 채널' },
        { name: '파트너 스트리머' },
        { name: '서비스 바로가기' }
    ];

    chrome.storage.sync.get('hiddenMenus', (data) => {
        if (chrome.runtime.lastError) return;
        
        const hiddenMenus = data.hiddenMenus || [];
        menuOptions.forEach(option => {
            const optionItem = document.createElement('div');
            optionItem.className = 'option-item';
            optionItem.innerHTML = `
                <span>${option.name} 끄기</span>
                <label class="switch">
                    <input type="checkbox" data-menu-name="${option.name}" ${hiddenMenus.includes(option.name) ? 'checked' : ''}>
                    <span class="slider"></span>
                </label>
            `;
            optionsContainer.appendChild(optionItem);

            const checkbox = optionItem.querySelector('input');
            checkbox.addEventListener('change', () => {
                const updatedHiddenMenus = [];
                document.querySelectorAll('#options-container input[type="checkbox"]').forEach(cb => {
                    if (cb.checked) {
                        updatedHiddenMenus.push(cb.dataset.menuName);
                    }
                });
                chrome.storage.sync.set({ hiddenMenus: updatedHiddenMenus }, () => {
                    if (chrome.runtime.lastError) return;
                });
            });
        });
    });

    const positionToggle = document.getElementById('position-toggle');

    chrome.storage.sync.get('groupPositionTop', (data) => {
        if (chrome.runtime.lastError) return;
        positionToggle.checked = data.groupPositionTop || false;
    });

    positionToggle.addEventListener('change', (event) => {
        chrome.storage.sync.set({ groupPositionTop: event.target.checked }, () => {
            if (chrome.runtime.lastError) return;
        });
    });
});