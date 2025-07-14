// chzzk_grouper/content.js

const menuSelectors = {
    '추천 채널': 'div.navigator_wrapper__ruh6f:nth-of-type(2)',
    '파트너 스트리머': 'div.navigator_wrapper__ruh6f:nth-of-type(3)',
    '서비스 바로가기': 'div.header_service__DyG7M:nth-of-type(2)'
};

function applyMenuSettings() {
    chrome.storage.sync.get('hiddenMenus', (data) => {
        if (chrome.runtime.lastError) return;
        const hiddenMenus = data.hiddenMenus || [];
        for (const menuName in menuSelectors) {
            const element = document.querySelector(menuSelectors[menuName]);
            if (element) {
                element.style.display = hiddenMenus.includes(menuName) ? 'none' : '';
            }
        }
    });
}

let draggedStreamer = { id: null, element: null, ghostElement: null };
let draggedGroup = { element: null, id: null, originalY: 0, ghostElement: null };

function handleStreamerMouseMove(event) {
    if (!draggedStreamer.ghostElement) return;
    draggedStreamer.ghostElement.style.left = `${event.clientX + 10}px`;
    draggedStreamer.ghostElement.style.top = `${event.clientY}px`;
    document.querySelectorAll('.chzzk-grouper-group-item').forEach(groupItem => {
        const rect = groupItem.getBoundingClientRect();
        if (event.clientX > rect.left && event.clientX < rect.right &&
            event.clientY > rect.top && event.clientY < rect.bottom) {
            groupItem.classList.add('drag-over');
        } else {
            groupItem.classList.remove('drag-over');
        }
    });
}

async function handleStreamerMouseUp(event) {
    if (!draggedStreamer.id) return;
    const dropTarget = document.querySelector('.chzzk-grouper-group-item.drag-over');
    if (dropTarget) {
        const groupContainer = dropTarget.closest('.chzzk-grouper-group-container');
        if (groupContainer && groupContainer.dataset.groupId) {
            const groupId = parseInt(groupContainer.dataset.groupId, 10);
            await addStreamerToGroup(draggedStreamer.id, groupId);
        }
        dropTarget.classList.remove('drag-over');
    }
    document.removeEventListener('mousemove', handleStreamerMouseMove);
    document.removeEventListener('mouseup', handleStreamerMouseUp);
    if (draggedStreamer.ghostElement) {
        draggedStreamer.ghostElement.remove();
    }
    document.querySelectorAll('.drag-over').forEach(item => item.classList.remove('drag-over'));
    document.body.style.cursor = '';
    draggedStreamer = { id: null, element: null, ghostElement: null };
}

function handleGroupMouseMove(event) {
    if (!draggedGroup.ghostElement) return;
    draggedGroup.ghostElement.style.transform = `translateY(${event.clientY - draggedGroup.originalY}px)`;
}

async function handleGroupMouseUp(event) {
    if (!draggedGroup.id) return;

    draggedGroup.ghostElement.style.display = 'none';
    const elementBelow = document.elementFromPoint(event.clientX, event.clientY);
    draggedGroup.ghostElement.style.display = '';

    const dropTarget = elementBelow ? elementBelow.closest('.chzzk-grouper-group-container') : null;

    if (dropTarget && dropTarget.dataset.groupId !== draggedGroup.id) {
        const fromId = parseInt(draggedGroup.id, 10);
        const toId = parseInt(dropTarget.dataset.groupId, 10);

        let groups = await getGroups();
        const fromIndex = groups.findIndex(g => g.id === fromId);
        const toIndex = groups.findIndex(g => g.id === toId);

        if (fromIndex > -1 && toIndex > -1) {
            const [movedGroup] = groups.splice(fromIndex, 1);
            groups.splice(toIndex, 0, movedGroup);
            await saveGroups(groups);
            await renderGroups();
        }
    }

    document.removeEventListener('mousemove', handleGroupMouseMove);
    document.removeEventListener('mouseup', handleGroupMouseUp);
    if (draggedGroup.ghostElement) {
        draggedGroup.ghostElement.remove();
    }
    document.body.style.cursor = '';
    draggedGroup = { element: null, id: null, originalY: 0, ghostElement: null };
}

function makeElementsDraggable() {
    const streamerSelector = ".navigator_item__qXlq9";
    const streamerElements = document.querySelectorAll(streamerSelector);

    streamerElements.forEach(element => {
        if (element.dataset.dragListenerAttached) return;
        element.dataset.dragListenerAttached = 'true';
        element.style.cursor = 'grab';

        element.addEventListener('mousedown', (event) => {
            if (event.button !== 0 || !element.href) return;
            event.preventDefault();

            draggedStreamer.id = element.href.split('/').pop();
            draggedStreamer.element = element;
            document.body.style.cursor = 'grabbing';

            const ghost = element.cloneNode(true);
            ghost.style.position = 'fixed';
            ghost.style.zIndex = '10000';
            ghost.style.pointerEvents = 'none';
            ghost.style.opacity = '0.8';
            ghost.style.width = `${element.offsetWidth}px`;
            ghost.style.left = `${event.clientX + 10}px`;
            ghost.style.top = `${event.clientY}px`;
            document.body.appendChild(ghost);
            draggedStreamer.ghostElement = ghost;

            document.addEventListener('mousemove', handleStreamerMouseMove);
            document.addEventListener('mouseup', handleStreamerMouseUp);
        });
    });
}

const storageKey = "chzzk_grouper_groups";

async function getStreamerInfoFromId(streamerId) {
    const url = `https://api.chzzk.naver.com/service/v1/channels/${streamerId}`;
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`서버 응답 오류 (상태 코드: ${response.status})`);
        }
        const data = await response.json();
        let channelInfo = null;
        if (data.content && data.content.channel) {
            channelInfo = data.content.channel;
        } else if (data.content && data.content.channelId) {
            channelInfo = data.content;
        } else {
            throw new Error("알 수 없는 채널 데이터 형식입니다.");
        }
        return {
            id: streamerId,
            name: channelInfo.channelName,
            profileImageUrl: channelInfo.channelImageUrl
        };
    } catch (error) {
        alert(`스트리머 정보를 가져오는 중 오류가 발생했습니다.\n\n원인: ${error.message}`);
        return null;
    }
}

async function addStreamerToGroup(streamerId, groupId) {
    const groups = await getGroups();
    const group = groups.find(g => g.id === groupId);
    if (!group) return;
    if (group.streamers.some(s => s.id === streamerId)) {
        alert("이미 그룹에 추가된 스트리머입니다.");
        return;
    }
    const streamerInfo = await getStreamerInfoFromId(streamerId);
    if (streamerInfo) {
        group.streamers.push(streamerInfo);
        await saveGroups(groups);
        renderGroups();
        alert(`${streamerInfo.name}님을 '${group.name}' 그룹에 추가했습니다.`);
    }
}

async function removeStreamerFromGroup(groupId, streamerId) {
    let groups = await getGroups();
    const group = groups.find(g => g.id === groupId);
    if (group) {
        const streamerIndex = group.streamers.findIndex(s => s.id === streamerId);
        if (streamerIndex > -1) {
            const streamerName = group.streamers[streamerIndex].name;
            if (confirm(`'${group.name}' 그룹에서 '${streamerName}'님을 정말 삭제하시겠습니까?`)) {
                group.streamers.splice(streamerIndex, 1);
                await saveGroups(groups);
                renderGroups();
            }
        }
    }
}

async function editGroupName(groupId) {
    let groups = await getGroups();
    const groupToEdit = groups.find(g => g.id === groupId);

    if (groupToEdit) {
        const newName = prompt("새로운 그룹 이름을 입력하세요:", groupToEdit.name);
        const trimmedNewName = newName ? newName.trim() : "";

        if (!trimmedNewName || trimmedNewName === groupToEdit.name) {
            return;
        }
        
        // ★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★
        // 수정된 부분: 다른 그룹 중에 중복된 이름이 있는지 확인
        const isDuplicate = groups.some(group => group.id !== groupId && group.name === trimmedNewName);

        if (isDuplicate) {
            alert("이미 같은 이름의 그룹이 존재합니다. 다른 이름을 사용해주세요.");
            return;
        }
        // ★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★

        groupToEdit.name = trimmedNewName;
        await saveGroups(groups);
        renderGroups();
    }
}

async function getGroups() {
    const data = await chrome.storage.sync.get(storageKey);
    return data[storageKey] || [];
}

async function saveGroups(groups) {
    await chrome.storage.sync.set({ [storageKey]: groups });
}

async function addGroup(name) {
    const groups = await getGroups();
    if (groups.some(group => group.name === name)) {
        alert("이미 같은 이름의 그룹이 존재합니다.");
        return;
    }
    groups.push({ id: Date.now(), name: name, streamers: [] });
    await saveGroups(groups);
    renderGroups();
    alert(`'${name}' 그룹이 추가되었습니다.`);
}

async function deleteGroup(id) {
    let groups = await getGroups();
    groups = groups.filter(group => group.id !== id);
    await saveGroups(groups);
    renderGroups();
}

async function renderGroups() {
    const groupListArea = document.getElementById('group-list-area');
    if (!groupListArea) return;

    groupListArea.innerHTML = '';
    const groups = await getGroups();
    if (groups.length === 0) {
        groupListArea.innerHTML = '<p>아직 그룹이 없습니다. "그룹 추가" 버튼을 눌러 만들어 보세요!</p>';
        return;
    }

    groups.forEach(group => {
        const groupContainer = document.createElement('div');
        groupContainer.className = 'chzzk-grouper-group-container';
        groupContainer.dataset.groupId = group.id;

        const groupItem = document.createElement('div');
        groupItem.className = 'chzzk-grouper-group-item';

        groupItem.innerHTML = `
            <div class="drag-handle">☰</div>
            <span>${group.name} (${group.streamers.length})</span>
            <div class="group-buttons">
                <button class="chzzk-grouper-button edit-group-btn" data-group-id="${group.id}">수정</button>
                <button class="chzzk-grouper-button delete-group-btn" data-group-id="${group.id}">삭제</button>
            </div>
        `;
        groupContainer.appendChild(groupItem);

        const streamerList = document.createElement('div');
        streamerList.className = 'chzzk-grouper-group-list';
        streamerList.id = `group-${group.id}`;

        if (group.streamers.length > 0) {
            group.streamers.forEach(streamer => {
                const streamerItem = document.createElement('div');
                streamerItem.className = 'chzzk-grouper-streamer-item';

                streamerItem.innerHTML = `
                    <a href="https://chzzk.naver.com/live/${streamer.id}" target="_blank">
                        <img src="${streamer.profileImageUrl}" class="chzzk-grouper-streamer-profile" alt="${streamer.name} 프로필">
                        <span>${streamer.name}</span>
                    </a>
                    <button class="streamer-delete-btn" title="그룹에서 삭제" data-group-id="${group.id}" data-streamer-id="${streamer.id}">삭제</button>
                `;

                streamerList.appendChild(streamerItem);

                streamerItem.querySelector('.streamer-delete-btn').addEventListener('click', (e) => {
                    e.stopPropagation();
                    const groupId = parseInt(e.target.dataset.groupId, 10);
                    const streamerId = e.target.dataset.streamerId;
                    removeStreamerFromGroup(groupId, streamerId);
                });
            });
        } else {
            streamerList.innerHTML = '<p style="font-size:12px; color:#aaa; padding-left:10px;">스트리머를 드래그하여 추가하세요.</p>';
        }
        groupContainer.appendChild(streamerList);
        groupListArea.appendChild(groupContainer);

        groupItem.querySelector('.drag-handle').addEventListener('mousedown', (e) => {
            e.preventDefault();
            draggedGroup.element = groupContainer;
            draggedGroup.id = groupContainer.dataset.groupId;
            draggedGroup.originalY = e.clientY;
            document.body.style.cursor = 'grabbing';

            const ghost = groupContainer.cloneNode(true);
            ghost.style.position = 'fixed';
            ghost.style.zIndex = '10000';
            ghost.style.pointerEvents = 'none';
            ghost.style.opacity = '0.8';
            ghost.style.width = `${groupContainer.offsetWidth}px`;
            ghost.style.left = `${groupContainer.getBoundingClientRect().left}px`;
            ghost.style.top = `${groupContainer.getBoundingClientRect().top}px`;
            document.body.appendChild(ghost);
            draggedGroup.ghostElement = ghost;

            document.addEventListener('mousemove', handleGroupMouseMove);
            document.addEventListener('mouseup', handleGroupMouseUp);
        });

        groupItem.querySelector('span').addEventListener('click', () => {
            streamerList.classList.toggle('expanded');
        });

        groupItem.querySelector('.edit-group-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            const groupId = parseInt(e.target.dataset.groupId, 10);
            editGroupName(groupId);
        });

        groupItem.querySelector('.delete-group-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            const groupId = parseInt(e.target.dataset.groupId, 10);
            const groupToDelete = groups.find(g => g.id === groupId);
            if (confirm(`'${groupToDelete.name}' 그룹을 정말 삭제하시겠습니까?`)) {
                deleteGroup(groupId);
            }
        });
    });
}

function initializeUI() {
    const followingContainer = document.querySelector(".navigator_wrapper__ruh6f:first-of-type");
    if (followingContainer) {
        if (document.getElementById('chzzk-grouper-container')) {
            makeElementsDraggable();
            return;
        }

        const groupContainer = document.createElement('div');
        groupContainer.className = 'chzzk-grouper-container';
        groupContainer.id = 'chzzk-grouper-container';
        groupContainer.innerHTML = `
            <div id="chzzk-grouper-header" class="chzzk-grouper-group-header">
                <span>내 그룹</span>
                <button id="add-group-btn" class="chzzk-grouper-button">그룹 추가</button>
            </div>
            <div id="group-list-area"></div>
        `;
        followingContainer.after(groupContainer);

        document.getElementById('add-group-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            const groupName = prompt("새로운 그룹 이름을 입력하세요:");
            if (groupName && groupName.trim() !== "") {
                addGroup(groupName.trim());
            }
        });

        document.getElementById('chzzk-grouper-header').addEventListener('click', () => {
            document.getElementById('group-list-area').classList.toggle('expanded');
        });

        renderGroups();
        makeElementsDraggable();
    }
}

const observer = new MutationObserver((mutations) => {
    initializeUI();
    applyMenuSettings();
});

observer.observe(document.body, {
    childList: true,
    subtree: true
});

initializeUI();
applyMenuSettings();