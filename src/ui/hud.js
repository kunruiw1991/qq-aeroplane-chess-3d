/**
 * Kid-Friendly Guide-Coach HUD, Setup Cards & 3D Podium Overlay
 * for QQ Aeroplane Chess 3D (QQ飞行棋 3D).
 *
 * Enforces:
 * - <= 6 visible clickable controls on EVERY screen
 * - >= 68x68px touch targets on every interactive control
 * - Zero scrollbars & zero overlaps across 1280x800, 1024x768, 844x390, 390x844
 */

import {
  COLOR_IDS,
  COLOR_META,
  PLANE_STATES,
  SCREEN_IDS,
  TEST_IDS,
  TURN_PHASES,
} from '../contracts/constants.js';

export class HudScreens {
  constructor(rootEl, callbacks = {}) {
    this.rootEl = rootEl;
    this.callbacks = callbacks;
    this.currentScreen = SCREEN_IDS.TITLE;
    this._buildDom();
  }

  _buildDom() {
    this.rootEl.innerHTML = `
      <!-- 1. TITLE SCREEN -->
      <section class="ui-screen screen-title" data-screen="${SCREEN_IDS.TITLE}">
        <div class="title-banner">
          <div class="title-badge-row">
            <span class="title-pill">QQ游戏大厅经典重制</span>
            <span class="title-pill gold">3D 蓝天棋盘</span>
          </div>
          <h1 class="title-heading">QQ飞行棋 3D</h1>
          <p class="title-subtitle">红 · 黄 · 蓝 · 绿 四色萌机 · 跳子飞棋大作战</p>
        </div>
        <div class="title-actions">
          <button type="button" class="sky-btn btn-primary-xl" data-testid="${TEST_IDS.BTN_TITLE_PLAY}">
            <span class="btn-icon">🚀</span>
            <span class="btn-text">开始飞行</span>
          </button>
          <button type="button" class="sky-btn btn-secondary-lg" data-testid="${TEST_IDS.BTN_TITLE_SETUP}">
            <span class="btn-icon">⚙️</span>
            <span class="btn-text">模式设置</span>
          </button>
        </div>
      </section>

      <!-- 2. SELECT / SETUP SCREEN -->
      <section class="ui-screen screen-select" data-screen="${SCREEN_IDS.SELECT}" hidden>
        <div class="setup-panel">
          <h2 class="setup-title">✈️ 飞行棋起飞设置</h2>
          <div class="setup-grid">
            <button type="button" class="setup-card" data-testid="${TEST_IDS.BTN_MODE_TOGGLE}">
              <span class="card-kicker">比赛模式</span>
              <span class="card-val" id="label-mode-val">⚡ 速战2机 (儿童推荐)</span>
            </button>
            <button type="button" class="setup-card" data-testid="${TEST_IDS.BTN_RULE_TOGGLE}">
              <span class="card-kicker">起飞规则</span>
              <span class="card-val" id="label-rule-val">🎲 5或6起飞 (畅快)</span>
            </button>
            <button type="button" class="setup-card" data-testid="${TEST_IDS.BTN_PLAYERS_TOGGLE}">
              <span class="card-kicker">玩家人数</span>
              <span class="card-val" id="label-players-val">🤖 1P 对战 3电脑</span>
            </button>
            <button type="button" class="setup-card" data-testid="${TEST_IDS.BTN_COLOR_TOGGLE}">
              <span class="card-kicker">我的机队</span>
              <span class="card-val" id="label-color-val">❤️ 红鹰号</span>
            </button>
          </div>
          <div class="setup-footer">
            <button type="button" class="sky-btn btn-primary-xl" data-testid="${TEST_IDS.BTN_START_MATCH}">
              <span class="btn-icon">🛫</span>
              <span class="btn-text">立即起飞</span>
            </button>
          </div>
        </div>
      </section>

      <!-- 3. PLAYING HUD SCREEN -->
      <section class="ui-screen screen-playing" data-screen="${SCREEN_IDS.PLAYING}" hidden>
        <div class="hud-top-bar">
          <div class="hud-roster-strip" id="hud-roster-strip"></div>
          <div class="hud-coach-pill" id="hud-coach-pill">
            <span class="coach-die" id="hud-coach-die">🎲</span>
            <span class="coach-text" id="hud-coach-text">点击下方大骰子起飞！</span>
          </div>
          <div class="hud-top-actions">
            <button type="button" class="sky-btn hud-icon-btn" data-testid="${TEST_IDS.HUD_BTN_AUDIO}" aria-label="切换音效">
              <span id="hud-audio-icon">🔊</span>
            </button>
            <button type="button" class="sky-btn hud-icon-btn" data-testid="${TEST_IDS.HUD_BTN_PAUSE}" aria-label="暂停菜单">
              <span>⏸</span>
            </button>
          </div>
        </div>

        <div class="hud-bottom-dock">
          <button type="button" class="sky-btn hud-plane-btn" data-testid="${TEST_IDS.HUD_BTN_PLANE_0}" hidden>
            <span class="plane-btn-num">✈️ 1号机</span>
            <span class="plane-btn-tag" id="plane-tag-0">起飞</span>
          </button>
          <button type="button" class="sky-btn hud-plane-btn" data-testid="${TEST_IDS.HUD_BTN_PLANE_1}" hidden>
            <span class="plane-btn-num">✈️ 2号机</span>
            <span class="plane-btn-tag" id="plane-tag-1">前进</span>
          </button>
          <button type="button" class="sky-btn hud-plane-btn" data-testid="${TEST_IDS.HUD_BTN_PLANE_2}" hidden>
            <span class="plane-btn-num">✈️ 3号机</span>
            <span class="plane-btn-tag" id="plane-tag-2">前进</span>
          </button>
          <button type="button" class="sky-btn hud-plane-btn" data-testid="${TEST_IDS.HUD_BTN_PLANE_3}" hidden>
            <span class="plane-btn-num">✈️ 4号机</span>
            <span class="plane-btn-tag" id="plane-tag-3">前进</span>
          </button>
          <button type="button" class="sky-btn hud-roll-btn" data-testid="${TEST_IDS.HUD_BTN_ROLL}">
            <span class="roll-die-icon" id="hud-roll-die-face">🎲</span>
            <span class="roll-btn-label" id="hud-roll-label">掷骰子</span>
          </button>
        </div>
      </section>

      <!-- 4. PAUSED OVERLAY SCREEN -->
      <section class="ui-screen screen-paused" data-screen="${SCREEN_IDS.PAUSED}" hidden>
        <div class="modal-card">
          <h2 class="modal-title">⏸ 飞行暂停</h2>
          <p class="modal-sub">同色跳 +4 格 · 虚线飞棋 +12 格并撞回敌机</p>
          <div class="modal-actions">
            <button type="button" class="sky-btn btn-primary-lg" data-testid="${TEST_IDS.BTN_RESUME}">
              <span>▶️ 继续飞行</span>
            </button>
            <button type="button" class="sky-btn btn-secondary-lg" data-testid="${TEST_IDS.BTN_RESTART}">
              <span>🔄 重新开始</span>
            </button>
            <button type="button" class="sky-btn btn-secondary-lg" data-testid="${TEST_IDS.BTN_QUIT_SELECT}">
              <span>⚙️ 模式设置</span>
            </button>
          </div>
        </div>
      </section>

      <!-- 5. 3D PODIUM SCREEN -->
      <section class="ui-screen screen-podium" data-screen="${SCREEN_IDS.PODIUM}" hidden>
        <div class="podium-top-card">
          <div class="podium-stars" id="podium-stars-banner">⭐⭐⭐</div>
          <h2 class="podium-headline" id="podium-headline">🏆 红鹰号 夺冠！</h2>
          <div class="podium-ranks-row" id="podium-ranks-row"></div>
        </div>
        <div class="podium-bottom-actions">
          <button type="button" class="sky-btn btn-primary-xl" data-testid="${TEST_IDS.BTN_PLAY_AGAIN}">
            <span class="btn-icon">🔄</span>
            <span class="btn-text">再飞一局</span>
          </button>
          <button type="button" class="sky-btn btn-secondary-lg" data-testid="${TEST_IDS.BTN_PODIUM_SELECT}">
            <span class="btn-icon">⚙️</span>
            <span class="btn-text">模式设置</span>
          </button>
        </div>
      </section>
    `;

    const bindClick = (testid, fn) => {
      const el = this.rootEl.querySelector(`[data-testid="${testid}"]`);
      if (el && fn) {
        el.addEventListener('click', (e) => {
          e.stopPropagation();
          fn();
        });
      }
    };

    bindClick(TEST_IDS.BTN_TITLE_PLAY, () => this.callbacks.onTitleQuickPlay?.());
    bindClick(TEST_IDS.BTN_TITLE_SETUP, () => this.callbacks.onOpenSelect?.());
    bindClick(TEST_IDS.BTN_MODE_TOGGLE, () => this.callbacks.onToggleMode?.());
    bindClick(TEST_IDS.BTN_RULE_TOGGLE, () => this.callbacks.onToggleRule?.());
    bindClick(TEST_IDS.BTN_PLAYERS_TOGGLE, () => this.callbacks.onTogglePlayers?.());
    bindClick(TEST_IDS.BTN_COLOR_TOGGLE, () => this.callbacks.onToggleColor?.());
    bindClick(TEST_IDS.BTN_START_MATCH, () => this.callbacks.onStartMatch?.());

    bindClick(TEST_IDS.HUD_BTN_AUDIO, () => this.callbacks.onToggleAudio?.());
    bindClick(TEST_IDS.HUD_BTN_PAUSE, () => this.callbacks.onTogglePause?.());
    bindClick(TEST_IDS.HUD_BTN_ROLL, () => this.callbacks.onRollOrQuickMove?.());
    bindClick(TEST_IDS.HUD_BTN_PLANE_0, () => this.callbacks.onSelectPlane?.(0));
    bindClick(TEST_IDS.HUD_BTN_PLANE_1, () => this.callbacks.onSelectPlane?.(1));
    bindClick(TEST_IDS.HUD_BTN_PLANE_2, () => this.callbacks.onSelectPlane?.(2));
    bindClick(TEST_IDS.HUD_BTN_PLANE_3, () => this.callbacks.onSelectPlane?.(3));

    bindClick(TEST_IDS.BTN_RESUME, () => this.callbacks.onTogglePause?.());
    bindClick(TEST_IDS.BTN_RESTART, () => this.callbacks.onRestartMatch?.());
    bindClick(TEST_IDS.BTN_QUIT_SELECT, () => this.callbacks.onOpenSelect?.());
    bindClick(TEST_IDS.BTN_PLAY_AGAIN, () => this.callbacks.onRestartMatch?.());
    bindClick(TEST_IDS.BTN_PODIUM_SELECT, () => this.callbacks.onOpenSelect?.());
  }

  setScreen(screenId) {
    this.currentScreen = screenId;
    const sections = this.rootEl.querySelectorAll('.ui-screen');
    sections.forEach((sec) => {
      sec.hidden = sec.getAttribute('data-screen') !== screenId;
    });
  }

  syncSelectedConfig(config) {
    const modeEl = this.rootEl.querySelector('#label-mode-val');
    if (modeEl) {
      modeEl.textContent =
        config.modeId === 'classic_4' ? '🏆 经典4机 (全员冲线)' : '⚡ 速战2机 (儿童推荐)';
    }
    const ruleEl = this.rootEl.querySelector('#label-rule-val');
    if (ruleEl) {
      ruleEl.textContent =
        config.takeoffRule === 'strict_six' ? '🎲 仅6起飞 (经典规则)' : '🎲 5或6起飞 (畅快起飞)';
    }
    const playersEl = this.rootEl.querySelector('#label-players-val');
    if (playersEl) {
      if (config.humanCount === 4) playersEl.textContent = '👨‍👩‍👧‍👦 四人同屏对战';
      else if (config.humanCount === 2) playersEl.textContent = '🧑‍🤝‍🧑 双人同屏 + 2电脑';
      else playersEl.textContent = '🤖 1P 对战 3电脑';
    }
    const colorEl = this.rootEl.querySelector('#label-color-val');
    if (colorEl) {
      const cid = COLOR_IDS[config.humanColorIndex] || 'red';
      const emojis = { red: '❤️', yellow: '💛', blue: '💙', green: '💚' };
      colorEl.textContent = `${emojis[cid]} ${COLOR_META[cid].nameZh}`;
    }
  }

  syncAudioMuted(muted) {
    const icon = this.rootEl.querySelector('#hud-audio-icon');
    if (icon) {
      icon.textContent = muted ? '🔇' : '🔊';
    }
  }

  updateHud(simSnap, muted = false) {
    this.syncAudioMuted(muted);
    if (!simSnap) return;

    // 1. Update 4-player progress strip
    const rosterEl = this.rootEl.querySelector('#hud-roster-strip');
    if (rosterEl && Array.isArray(simSnap.players)) {
      rosterEl.innerHTML = simSnap.players
        .map((p) => {
          const isTurn = p.colorIndex === simSnap.currentPlayer;
          return `
            <div class="roster-chip ${isTurn ? 'active-turn' : ''}" style="--chip-color:${p.hex}">
              <span class="chip-dot"></span>
              <span class="chip-name">${p.shortZh}</span>
              <span class="chip-crown">👑${p.crownedCount}/${simSnap.planesToWin}</span>
            </div>
          `;
        })
        .join('');
    }

    // 2. Update Coach Banner
    const activePlayer = simSnap.players?.[simSnap.currentPlayer];
    const dieFaces = ['', '⚀ 1', '⚁ 2', '⚂ 3', '⚃ 4', '⚄ 5', '⚅ 6'];
    const rolledVal = simSnap.diceValue || simSnap.lastDiceRoll;
    const dieEl = this.rootEl.querySelector('#hud-coach-die');
    const textEl = this.rootEl.querySelector('#hud-coach-text');

    if (dieEl) {
      dieEl.textContent = rolledVal ? dieFaces[rolledVal] || `🎲 ${rolledVal}` : '🎲';
    }

    if (textEl && activePlayer) {
      if (simSnap.turnPhase === TURN_PHASES.TRIPLE_SIX) {
        textEl.textContent = `${activePlayer.nameZh} 连续三个6！安全限制换下一位`;
      } else if (simSnap.turnPhase === TURN_PHASES.NO_MOVES) {
        textEl.textContent = `${activePlayer.nameZh} 投出 ${rolledVal} 点，无可移动飞机`;
      } else if (simSnap.turnPhase === TURN_PHASES.AWAIT_MOVE) {
        const bonusNote = simSnap.bonusRoll ? ' (奖励再投!)' : '';
        textEl.textContent = `${activePlayer.nameZh} 投出 ${rolledVal} 点！点击发光飞机出发${bonusNote}`;
      } else if (activePlayer.isAi) {
        textEl.textContent = `${activePlayer.nameZh} (电脑) 正在思考航线...`;
      } else {
        textEl.textContent = `轮到 ${activePlayer.nameZh}：点击【掷骰子】或按空格键！`;
      }
    }

    // 3. Update Bottom Action Dock (strictly <= 6 visible clickable controls!)
    const isHumanMoveChoice =
      simSnap.turnPhase === TURN_PHASES.AWAIT_MOVE &&
      activePlayer &&
      !activePlayer.isAi &&
      Array.isArray(simSnap.legalMoves) &&
      simSnap.legalMoves.length > 0;

    const legalMap = new Map();
    if (isHumanMoveChoice) {
      for (const m of simSnap.legalMoves) {
        legalMap.set(m.planeIndex, m);
      }
    }

    const planeTestIds = [
      TEST_IDS.HUD_BTN_PLANE_0,
      TEST_IDS.HUD_BTN_PLANE_1,
      TEST_IDS.HUD_BTN_PLANE_2,
      TEST_IDS.HUD_BTN_PLANE_3,
    ];

    for (let pIdx = 0; pIdx < 4; pIdx += 1) {
      const btn = this.rootEl.querySelector(`[data-testid="${planeTestIds[pIdx]}"]`);
      const tag = this.rootEl.querySelector(`#plane-tag-${pIdx}`);
      if (!btn) continue;
      const move = legalMap.get(pIdx);
      if (move) {
        btn.hidden = false;
        btn.style.setProperty('--plane-color', activePlayer.hex);
        if (tag) {
          if (move.crowned) tag.textContent = '🏆 冲线!';
          else if (move.allCaptureTargets?.length > 0) tag.textContent = '💥 撞敌机!';
          else if (move.didFly) tag.textContent = '🚀 飞棋+12';
          else if (move.didJump) tag.textContent = '⚡ 跳子+4';
          else if (move.tookOff) tag.textContent = '🛫 起飞';
          else tag.textContent = `前进+${simSnap.diceValue}`;
        }
      } else {
        btn.hidden = true;
      }
    }

    // Roll button: hide ONLY when all 4 plane buttons are visible simultaneously
    // so total visible clickable controls is NEVER > 6 (2 top + 4 plane = 6)!
    const rollBtn = this.rootEl.querySelector(`[data-testid="${TEST_IDS.HUD_BTN_ROLL}"]`);
    const rollFace = this.rootEl.querySelector('#hud-roll-die-face');
    const rollLabel = this.rootEl.querySelector('#hud-roll-label');
    if (rollBtn) {
      rollBtn.hidden = legalMap.size >= 4;
      rollBtn.disabled = Boolean(activePlayer?.isAi);
      if (rollFace) {
        rollFace.textContent = rolledVal ? `${rolledVal}点` : '🎲';
      }
      if (rollLabel) {
        if (isHumanMoveChoice) {
          rollLabel.textContent = '智能出发';
        } else if (activePlayer?.isAi) {
          rollLabel.textContent = '电脑回合';
        } else {
          rollLabel.textContent = '掷骰子';
        }
      }
    }
  }

  updatePodium(simSnap) {
    if (!simSnap) return;
    const starsEl = this.rootEl.querySelector('#podium-stars-banner');
    const headlineEl = this.rootEl.querySelector('#podium-headline');
    const ranksRowEl = this.rootEl.querySelector('#podium-ranks-row');

    const rankings = simSnap.rankings || [];
    const winner = rankings[0];
    const humanStars = simSnap.humanStars ?? 3;

    if (starsEl) {
      starsEl.textContent =
        humanStars > 0 ? '⭐'.repeat(humanStars) : '💪 再接再厉 (0星)';
    }
    if (headlineEl && winner) {
      headlineEl.textContent = `🏆 第一名：${winner.nameZh} (${winner.stars}星夺冠！)`;
    }
    if (ranksRowEl) {
      const medals = ['🥇 冠军', '🥈 亚军', '🥉 季军', '4️⃣ 第四名'];
      ranksRowEl.innerHTML = rankings
        .map(
          (r, idx) => `
          <div class="podium-rank-chip">
            <span class="rank-medal">${medals[idx] || ''}</span>
            <span class="rank-name">${r.nameZh}</span>
            <span class="rank-stat">👑${r.crownedCount} · 💥${r.capturesMade} · ${'⭐'.repeat(r.stars) || '0星'}</span>
          </div>
        `
        )
        .join('');
    }
  }

  getVisibleClickableCount() {
    const isVisible = (el) => {
      let cur = el;
      while (cur && cur.nodeType === 1) {
        if (cur.hidden || cur.getAttribute('aria-hidden') === 'true') return false;
        const cs = window.getComputedStyle(cur);
        if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) === 0) {
          return false;
        }
        cur = cur.parentElement;
      }
      const r = el.getBoundingClientRect();
      return r.width > 1 && r.height > 1;
    };
    const buttons = Array.from(this.rootEl.querySelectorAll('button')).filter(isVisible);
    return buttons.length;
  }
}
