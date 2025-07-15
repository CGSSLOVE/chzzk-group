document.addEventListener('DOMContentLoaded', () => {
    const optionsContainer = document.getElementById('options-container');
    const menuOptions = [
        { name: '추천 채널' },
        { name: '파트너 스트리머' },
        { name: '서비스 바로가기' }
    ];

    chrome.storage.local.get('hiddenMenus', (data) => {
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
                chrome.storage.local.set({ hiddenMenus: updatedHiddenMenus }, () => {
                    if (chrome.runtime.lastError) return;
                });
            });
        });
    });

    const positionToggle = document.getElementById('position-toggle');

    chrome.storage.local.get('groupPositionTop', (data) => {
        if (chrome.runtime.lastError) return;
        positionToggle.checked = data.groupPositionTop || false;
    });

    positionToggle.addEventListener('change', (event) => {
        chrome.storage.local.set({ groupPositionTop: event.target.checked }, () => {
            if (chrome.runtime.lastError) return;
        });
    });

    const exportDataBtn = document.getElementById('export-data-btn');
    const importDataBtn = document.getElementById('import-data-btn');
    const importFileInput = document.getElementById('import-file-input');

    exportDataBtn.addEventListener('click', () => {
        chrome.storage.local.get('chzzk_grouper_groups', (data) => {
            const groups = data.chzzk_grouper_groups || [];
            const jsonString = JSON.stringify(groups, null, 2);
            const blob = new Blob([jsonString], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'chzzk-grouper-backup.json';
            a.click();
            URL.revokeObjectURL(url);
            alert('그룹 데이터가 성공적으로 내보내졌습니다.');
        });
    });

    importDataBtn.addEventListener('click', () => {
        importFileInput.click();
    });

    importFileInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const groupsToImport = JSON.parse(e.target.result);
                if (Array.isArray(groupsToImport)) {
                    chrome.storage.local.set({ 'chzzk_grouper_groups': groupsToImport }, () => {
                        alert('그룹 데이터가 성공적으로 가져와졌습니다. 팝업을 다시 열어 확인하세요.');
                    });
                } else {
                    alert('유효한 JSON 형식이 아닙니다.');
                }
            } catch (error) {
                alert('파일을 읽는 중 오류가 발생했습니다: ' + error.message);
            }
        };
        reader.readAsText(file);
    });
});
