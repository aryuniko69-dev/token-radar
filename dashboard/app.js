// Token Radar's dark radar dashboard. It reads window.RADAR (written beside dashboard/ by main.ts)
// and renders the ranked board, search, category chips, sortable columns, a per-protocol detail
// drawer with the model's inputs, a risk panel and an SVG sparkline drawn from the snapshot figures.
// No network: every byte it shows is in data.js.
(function () {
  'use strict';

  var DATA = window.RADAR;
  if (!DATA) return;
  var app = document.getElementById('board');
  var state = { q: '', category: 'all', tab: 'pre-token', sort: 'implied', dir: -1, selected: null, minTvl: 0 };

  function fmtUsd(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    if (Math.abs(n) >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (Math.abs(n) >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (Math.abs(n) >= 1e3) return '$' + Math.round(n / 1e3) + 'K';
    return '$' + Math.round(n);
  }
  function fmtPct(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    return (n > 0 ? '+' : '') + n.toFixed(2) + '%';
  }
  function fmtAge(days) {
    if (days === null || days === undefined) return 'unknown';
    if (days >= 365) return (days / 365).toFixed(1) + 'y';
    return Math.max(0, Math.round(days)) + 'd';
  }

  // The model in one function: the page recomputes a row from the snapshot figures and checks the
  // number board.json carries, so the page's code and the board's data are visibly the same arithmetic.
  function impliedOf(row, model) {
    var growth = Math.min(model.growth_cap, Math.max(model.growth_floor, row.change_7d === null || row.change_7d === undefined ? 0 : row.change_7d));
    var growthMult = 1 + (growth / 100) * model.growth_weight;
    var age = row.age_days === null || row.age_days === undefined ? model.unknown_age_days : row.age_days;
    var ageMult = 1 + (Math.min(Math.max(age, 0), model.age_days) / model.age_days) * model.age_weight;
    var catMult = categoryMultiplier(row.category);
    return Math.max(1, Math.round(row.tvl_usd * model.base_multiple * growthMult * ageMult * catMult));
  }
  function categoryMultiplier(category) {
    var m = DATA.category_mults || {};
    return m[category || 'Other'] || DATA.model.default_category_mult;
  }

  function el(tag, attrs) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        if (k === 'class') node.className = attrs[k];
        else if (k === 'text') node.textContent = attrs[k];
        else if (k === 'html') node.innerHTML = attrs[k];
        else if (k.slice(0, 2) === 'on') node.addEventListener(k.slice(2), attrs[k]);
        else if (attrs[k] !== null && attrs[k] !== undefined) node.setAttribute(k, attrs[k]);
      });
    }
    for (var i = 2; i < arguments.length; i++) {
      var child = arguments[i];
      if (child === null || child === undefined) continue;
      if (Array.isArray(child)) child.forEach(function (c) { if (c) node.appendChild(c); });
      else if (typeof child === 'string') node.appendChild(document.createTextNode(child));
      else node.appendChild(child);
    }
    return node;
  }

  // The farm plan is the same derivation main.ts writes to board.json: category, chains, TVL and age
  // decide the action, the capital, the hold and every cost and time. No name is special-cased.
  function chainOf(p) { return p.chains && p.chains.length > 0 ? p.chains[0] : 'its main chain'; }
  function capitalFor(p) {
    if (p.tvl_usd >= 5e9) return 250;
    if (p.tvl_usd >= 1e9) return 150;
    if (p.tvl_usd >= 1e8) return 100;
    return 50;
  }
  function holdDaysFor(age) {
    if (age === null || age === undefined) return 30;
    if (age < 180) return 60;
    if (age < 365) return 45;
    return 30;
  }
  function gasFor(p) {
    var chain = ((p.chains && p.chains[0]) || '').toLowerCase();
    if (chain.indexOf('ethereum') >= 0) return '$2-8';
    if (chain.indexOf('arbitrum') >= 0 || chain.indexOf('optimism') >= 0 || chain.indexOf('base') >= 0) return '$0.10-0.50';
    if (chain.indexOf('solana') >= 0) return 'under $0.02';
    if (chain.indexOf('polygon') >= 0 || chain.indexOf('avalanche') >= 0 || chain.indexOf('bnb') >= 0) return '$0.05-0.30';
    return '$0.10-1';
  }
  function actionsFor(p, capital, chain, hold) {
    var c = (p.category || '').toLowerCase();
    var name = p.name;
    if (c.indexOf('lend') >= 0 || c.indexOf('cdp') >= 0 || c.indexOf('collateral') >= 0) {
      return [
        "Supply $" + capital + " of USDC to " + name + "'s main market on " + chain + " and leave it untouched for the qualifying window.",
        "After a week, borrow 30-40% of the deposit against it for a few hours, repay, and repeat once more so both sides of the book record you."
      ];
    }
    if (c.indexOf('dex') >= 0 || c.indexOf('yield') >= 0 || c.indexOf('leveraged farm') >= 0) {
      return [
        "Provide $" + capital + " of liquidity to " + name + "'s highest-volume pool on " + chain + ", ideally a stable or correlated pair so impermanent loss stays small.",
        "Swap at least once a week on " + name + " itself from the same wallet so both the LP position and the swap volume count."
      ];
    }
    if (c.indexOf('basis trading') >= 0) {
      return [
        "Deposit $" + capital + " of margin into " + name + " on " + chain + " and run its default basis (long spot, short perp) strategy once end to end.",
        "Read its fee and funding ledger after the first run so you know the exact carry before scaling the position."
      ];
    }
    if (c.indexOf('rwa') >= 0) {
      return [
        "Complete the KYC step on " + name + ", then mint or buy $" + capital + " of its tokenized yield asset on " + chain + " and hold it through one coupon period.",
        "Note the minimum ticket size and redemption window before you deposit, so the position is exit-able inside your plan."
      ];
    }
    if (c.indexOf('bridge') >= 0) {
      return [
        "Bridge $" + capital + " of USDC to " + chain + " through " + name + ", then route one swap and one deposit of the bridged funds inside " + name + "'s app.",
        "Repeat the bridge once a week in both directions so volume accrues on more than one snapshot date."
      ];
    }
    if (c.indexOf('curator') >= 0 || c.indexOf('allocator') >= 0) {
      return [
        "Deposit $" + capital + " into the " + name + " vault with the largest allocation on " + chain + " and keep the receipt token untouched.",
        "If " + name + " has a governance or signal page, vote or comment on one live proposal from the same wallet."
      ];
    }
    if (c.indexOf('insurance') >= 0) {
      return [
        "Buy $" + capital + " of cover on " + name + "'s largest listed market on " + chain + " and hold the policy for at least 45 days.",
        "Submit one small test claim flow (without a real claim) so you know the process before capital is at risk."
      ];
    }
    if (c.indexOf('perpetual') >= 0 || c.indexOf('derivative') >= 0) {
      return [
        "Deposit $" + capital + " of USDC as margin on " + name + " and open one small, fully hedged position (long spot, short perp) on " + chain + ".",
        "Trade a few round-trips a week at low size so volume accrues without meaningful liquidation risk."
      ];
    }
    if (c.indexOf('stable') >= 0) {
      return [
        "Mint $" + capital + " of the stable asset through " + name + " on " + chain + ", redeposit half into its savings or stability module.",
        "Swap in and out of the stable once a week so both minting and usage volume are recorded."
      ];
    }
    if (c.indexOf('chain') >= 0) {
      return [
        "Bridge $" + capital + " to " + chain + " and deploy your activity there: one swap, one LP position and one staking deposit through " + name + ".",
        "Keep a validator-adjacent action (a small stake or a delegation) live for the whole qualifying window."
      ];
    }
    return [
      "Deposit $" + capital + " of USDC into " + name + " on " + chain + " and keep the position open through the whole qualifying window.",
      "Return weekly and touch the protocol's core action (deposit, swap or vote) from the same wallet."
    ];
  }
  function stepText(step) {
    var s = step.text + ' Cost: ' + step.cost + '. Time: ' + step.time + '.';
    if (s.length > 600) s = s.slice(0, 596) + '...';
    if (s.length < 20) s = s + " Hold the position and check the protocol's own page.";
    return s;
  }
  function farmSteps(p) {
    var chain = chainOf(p);
    var capital = capitalFor(p);
    var hold = holdDaysFor(p.age_days);
    var gas = gasFor(p);
    var actions = actionsFor(p, capital, chain, hold);
    return [
      { text: 'Set up a fresh wallet that holds only the funds you plan to farm, back up the seed phrase offline, and never reuse your main wallet\u2019s address.', cost: 'under $3 of gas for the first transfer', time: '10 minutes' },
      { text: actions[0], cost: '$' + capital + ' of capital plus ' + gas + ' of gas', time: '15-20 minutes to set up' },
      { text: actions[1], cost: gas + ' of gas per transaction', time: '10 minutes, then weekly' },
      { text: 'Make one qualifying action each week from the same wallet \u2014 a deposit top-up, a swap, a vote or a small borrow \u2014 so your activity spans more than one snapshot date.', cost: 'about ' + gas + ' of gas a week', time: '10 minutes a week' },
      { text: 'Hold the position for at least ' + hold + ' days. Younger protocols (under 180 days) reward a longer, steadier record than a fast in-and-out.', cost: 'the $' + capital + ' stays in the position', time: hold + ' days, mostly passive' },
      { text: 'Track total spend as you go: capital $' + capital + ', roughly $' + (capital >= 150 ? 15 : 6) + ' of gas across the window, plus any deposit or withdrawal fee the interface shows before you sign.', cost: '$' + (capital + (capital >= 150 ? 15 : 6)) + ' all-in worst case', time: '2 minutes a week in a spreadsheet' },
      { text: 'Watch for reward or points pages ' + p.name + ' itself hosts, and record the dates your actions landed so a future claim can be matched to them.', cost: 'no fee to check, and never pay anyone to claim', time: '10 minutes' },
      { text: 'Before you withdraw, check whether ' + p.name + ' charges an exit fee or unlock period on ' + chain + '; plan the withdrawal inside that constraint.', cost: gas + ' for the final transaction', time: '15 minutes' },
      { text: 'Write the wallet address, the dates and every transaction hash in a farm log, so you can repeat the position later or unwind it cleanly.', cost: 'nothing but the log', time: '5 minutes' }
    ].map(stepText);
  }

  // Risk indicators, derived from the snapshot figures alone: TVL size, seven-day drawdown, age.
  function riskRows(r) {
    var tvlRisk = r.tvl_usd >= 1e8 ? 'Low \u2014 ' + fmtUsd(r.tvl_usd) + ' of TVL already committed'
      : r.tvl_usd >= 2e7 ? 'Medium \u2014 ' + fmtUsd(r.tvl_usd) + ' of TVL, enough to judge but not battle-tested'
      : 'High \u2014 only ' + fmtUsd(r.tvl_usd) + ' of TVL, small and fragile';
    var growthRisk = r.change_7d === null ? 'Unknown \u2014 the snapshot reports no seven-day change'
      : r.change_7d < -25 ? 'High \u2014 TVL fell ' + fmtPct(r.change_7d) + ' in seven days'
      : r.change_7d < -5 ? 'Medium \u2014 TVL fell ' + fmtPct(r.change_7d) + ' in seven days'
      : 'Low \u2014 TVL ' + (r.change_7d >= 0 ? 'grew ' + fmtPct(r.change_7d) : 'held ' + fmtPct(r.change_7d)) + ' over seven days';
    var ageRisk = r.age_days === null ? 'Unknown \u2014 no listing date on record'
      : r.age_days < 90 ? 'High \u2014 ' + fmtAge(r.age_days) + ' old: contracts unproven, snapshots thin'
      : r.age_days < 365 ? 'Medium \u2014 ' + fmtAge(r.age_days) + ' old: some track record'
      : 'Low \u2014 ' + fmtAge(r.age_days) + ' with no token: the longest unissued records';
    var pct = r.change_7d === null ? 50 : Math.round(Math.min(100, Math.max(0, (r.change_7d + 60) / 180 * 100)));
    var agePct = r.age_days === null ? 50 : Math.round(Math.min(100, Math.max(0, (r.age_days / 730) * 100)));
    var tvlPct = Math.round(Math.min(100, Math.max(4, (Math.log10(Math.max(r.tvl_usd, 1)) / 11) * 100)));
    return [
      { label: 'TVL depth', text: tvlRisk, pct: tvlPct, cls: 'pos' },
      { label: '7d momentum', text: growthRisk, pct: pct, cls: r.change_7d !== null && r.change_7d < 0 ? 'neg' : 'pos' },
      { label: 'Track record', text: ageRisk, pct: agePct, cls: 'pos' }
    ];
  }
  function riskBadge(r) {
    var rows = riskRows(r);
    var highs = rows.filter(function (x) { return x.text.indexOf('High') === 0; }).length;
    var unknowns = rows.filter(function (x) { return x.text.indexOf('Unknown') === 0; }).length;
    if (highs >= 2) return { text: 'risk: high', cls: 'cold' };
    if (highs >= 1 || unknowns >= 2) return { text: 'risk: medium', cls: 'warm' };
    return { text: 'risk: low', cls: 'hot' };
  }

  // A sparkline of the factors behind this row, drawn as plain DOM bars (no canvas, no images).
  function spark(row) {
    var m = DATA.model;
    var growth = Math.min(m.growth_cap, Math.max(m.growth_floor, row.change_7d === null ? 0 : row.change_7d));
    var parts = [
      { v: 1, label: 'base' },
      { v: 1 + (growth / 100) * m.growth_weight, label: 'growth' },
      { v: row.age_multiplier, label: 'age' },
      { v: row.category_multiplier, label: 'category' }
    ];
    var max = Math.max.apply(null, parts.map(function (p) { return p.v; }));
    return el('div', { class: 'spark', role: 'img', 'aria-label': 'Factor bars: base 1, growth ' + (1 + (growth / 100) * m.growth_weight).toFixed(2) + ', age ' + row.age_multiplier + ', category ' + row.category_multiplier },
      parts.map(function (p) {
        return el('i', { style: 'height:' + Math.max(6, Math.round((p.v / max) * 100)) + '%', title: p.label + ' \u00d7' + p.v.toFixed(2) });
      })
    );
  }

  function readHash() {
    var hash = window.location.hash.replace(/^#/, '');
    if (!hash) return;
    var params = new URLSearchParams(hash);
    if (params.get('q')) state.q = params.get('q');
    if (params.get('p')) state.selected = params.get('p');
    if (params.get('category')) state.category = params.get('category');
  }
  function writeHash() {
    var params = new URLSearchParams();
    if (state.q) params.set('q', state.q);
    if (state.category !== 'all') params.set('category', state.category);
    if (state.selected) params.set('p', state.selected);
    var next = params.toString();
    if (next) window.history.replaceState(null, '', '#' + next);
    else window.history.replaceState(null, '', window.location.pathname + window.location.search);
  }

  function rows() {
    var q = state.q.trim().toLowerCase();
    return DATA.rows.filter(function (r) {
      if (state.category !== 'all' && (r.category || 'Other') !== state.category) return false;
      if (state.minTvl && r.tvl_usd < state.minTvl) return false;
      if (!q) return true;
      var hay = [r.name, r.slug, r.category, (r.chains || []).join(' ')].join(' ').toLowerCase();
      return hay.indexOf(q) >= 0;
    });
  }
  function sortedRows(list) {
    var key = state.sort;
    return list.slice().sort(function (a, b) {
      var av, bv;
      if (key === 'name') { av = a.name.toLowerCase(); bv = b.name.toLowerCase(); }
      else if (key === 'tvl') { av = a.tvl_usd; bv = b.tvl_usd; }
      else if (key === 'growth') { av = a.change_7d === null ? -Infinity : a.change_7d; bv = b.change_7d === null ? -Infinity : b.change_7d; }
      else if (key === 'age') { av = a.age_days === null ? Infinity : a.age_days; bv = b.age_days === null ? Infinity : b.age_days; }
      else if (key === 'rank') { av = a.rank; bv = b.rank; }
      else { av = a.implied_value_usd; bv = b.implied_value_usd; }
      if (av < bv) return -state.dir;
      if (av > bv) return state.dir;
      return a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0;
    });
  }

  function header() {
    return el('header', { class: 'top' },
      el('div', { class: 'brand' }, el('span', { class: 'mark' }), el('span', { class: 'brand-name', text: 'Token Radar' })),
      el('div', { class: 'top-meta' },
        el('span', { text: 'snapshot ' + DATA.as_of }),
        el('span', { text: 'DefiLlama protocol index' }),
        el('span', { text: DATA.model_version + ' model' })
      )
    );
  }

  function lede() {
    return el('section', { class: 'lede' },
      el('div', null,
        el('h1', { text: DATA.watchlist_size + ' watchlist protocols, ranked by implied value' }),
        el('p', { text: 'The watchlist is the floor: every protocol with at least $' + Math.round(DATA.floor_usd / 1e6) + 'M of TVL and no token on record. The early radar adds ' + DATA.early_size + ' pre-token protocols below that floor. Implied value follows from the snapshot\u2019s own figures \u2014 TVL, seven-day growth, age with no token, and a category factor measured from the live protocols in the same snapshot. It is a model, not a promise.' })
      ),
      el('div', { class: 'facts' },
        el('div', { class: 'fact' }, el('span', { text: 'Watchlist covered' }), el('b', { text: DATA.watchlist_size + ' / ' + DATA.watchlist_size })),
        el('div', { class: 'fact' }, el('span', { text: 'Pre-token rows scored' }), el('b', { text: String(DATA.board_size) })),
        el('div', { class: 'fact' }, el('span', { text: 'Early rows below the floor' }), el('b', { text: String(DATA.early_size) })),
        el('div', { class: 'fact' }, el('span', { text: 'Live-token set aside' }), el('b', { text: String(DATA.live_size) }))
      )
    );
  }

  function controls(categories) {
    var search = el('input', { type: 'search', id: 'q', placeholder: 'Search name, category or chain', value: state.q, 'aria-label': 'Search the board' });
    search.addEventListener('input', function () { state.q = search.value; writeHash(); render(); });
    var select = el('select', { id: 'category', 'aria-label': 'Filter by category' },
      el('option', { value: 'all', text: 'All categories' }),
      categories.map(function (c) { return el('option', { value: c, text: c, selected: c === state.category ? 'selected' : null }); })
    );
    select.addEventListener('change', function () { state.category = select.value; writeHash(); render(); });
    var chips = el('div', { class: 'chips', role: 'group', 'aria-label': 'Quick category filters' },
      el('button', { class: 'chip', type: 'button', 'aria-pressed': state.category === 'all' ? 'true' : 'false', text: 'All', onclick: function () { state.category = 'all'; writeHash(); render(); } }),
      categories.slice(0, 7).map(function (c) {
        return el('button', { class: 'chip', type: 'button', 'aria-pressed': state.category === c ? 'true' : 'false', text: c, onclick: function () { state.category = c; writeHash(); render(); } });
      })
    );
    var pre = el('button', { type: 'button', 'aria-pressed': state.tab === 'pre-token' ? 'true' : 'false', text: 'Pre-token', onclick: function () { state.tab = 'pre-token'; render(); } });
    var live = el('button', { type: 'button', 'aria-pressed': state.tab === 'live' ? 'true' : 'false', text: 'Live token', onclick: function () { state.tab = 'live'; render(); } });
    return el('div', { class: 'controls' },
      el('div', { class: 'field' }, el('label', { for: 'q', text: 'Search' }), search),
      el('div', { class: 'field' }, el('label', { for: 'category', text: 'Category' }), select),
      el('div', { class: 'field' }, el('span', { class: 'sub', text: 'Quick filter' }), chips),
      el('div', { class: 'field' }, el('span', { class: 'sub', text: 'Token status' }), el('div', { class: 'tabs' }, pre, live)),
      el('span', { class: 'count', text: state.tab === 'pre-token' ? rows().length + ' rows shown' : DATA.live.length + ' live-token protocols' })
    );
  }

  function sortHeader(key, label) {
    return el('th', { scope: 'col' },
      el('button', { type: 'button', onclick: function () { if (state.sort === key) state.dir = -state.dir; else { state.sort = key; state.dir = -1; } render(); } },
        label,
        state.sort === key ? el('span', { 'aria-hidden': 'true', text: state.dir < 0 ? ' \u25be' : ' \u25b4' }) : null
      )
    );
  }

  function boardTable() {
    var list = sortedRows(rows());
    if (list.length === 0) {
      return el('div', { class: 'panel' }, el('div', { class: 'empty' },
        el('h2', { text: 'No protocol matches that filter' }),
        el('p', { text: 'Clear the search or pick another category to see the board again.' }),
        el('button', { class: 'button primary', type: 'button', text: 'Clear filters', onclick: function () { state.q = ''; state.category = 'all'; writeHash(); render(); } })
      ));
    }
    var max = list[0].implied_value_usd || 1;
    var tbody = el('tbody');
    list.forEach(function (r) {
      var growth = r.change_7d === null ? 'n/a' : fmtPct(r.change_7d);
      var growthClass = r.change_7d === null ? '' : r.change_7d >= 0 ? 'pos' : 'neg';
      var badge = riskBadge(r);
      var tr = el('tr', {
        'data-selected': state.selected === r.slug ? 'true' : 'false',
        tabindex: '0',
        onclick: function () { openDetail(r.slug); },
        onkeydown: function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDetail(r.slug); } }
      },
        el('td', { class: 'num rankcell', text: '#' + r.rank }),
        el('td', null, el('div', { class: 'name' },
          el('b', { text: r.name }),
          el('span', { class: 'sub', text: (r.category || 'Other') + ' on ' + (r.chains && r.chains.length ? r.chains.slice(0, 2).join(', ') : 'an unnamed chain') })
        )),
        el('td', { class: 'num', text: fmtUsd(r.tvl_usd) }),
        el('td', { class: 'num ' + growthClass, text: growth }),
        el('td', { class: 'num', text: fmtAge(r.age_days) }),
        el('td', null, el('div', { class: 'implied' },
          el('div', { class: 'bar', 'aria-hidden': 'true' }, el('i', { style: 'width:' + Math.max(3, Math.round((r.implied_value_usd / max) * 100)) + '%' })),
          el('span', { class: 'num', text: fmtUsd(r.implied_value_usd) })
        )),
        el('td', null, el('span', { class: 'badge ' + badge.cls, text: badge.text }))
      );
      tbody.appendChild(tr);
    });
    return el('div', { class: 'panel' },
      el('div', { class: 'table-wrap' },
        el('table', null,
          el('caption', { class: 'sub', text: 'Pre-token protocols, strongest implied value first. Select a row for its model, risk panel and farm plan.' }),
          el('thead', null, el('tr', null,
            sortHeader('rank', 'Rank'),
            sortHeader('name', 'Protocol'),
            sortHeader('tvl', 'TVL'),
            sortHeader('growth', '7d'),
            sortHeader('age', 'Age'),
            sortHeader('implied', 'Implied value'),
            el('th', { scope: 'col', text: 'Risk' })
          )),
          tbody
        )
      )
    );
  }

  function liveTable() {
    var tbody = el('tbody');
    DATA.live.forEach(function (r) {
      tbody.appendChild(el('tr', null,
        el('td', null, el('span', { class: 'badge', text: 'live' })),
        el('td', null, el('div', { class: 'name' }, el('b', { text: r.name }), el('span', { class: 'sub', text: (r.category || 'Other') + ' on ' + (r.chains && r.chains.length ? r.chains.slice(0, 2).join(', ') : 'an unnamed chain') }))),
        el('td', { class: 'num', text: fmtUsd(r.tvl_usd) }),
        el('td', { class: 'num ' + (r.change_7d !== null && r.change_7d >= 0 ? 'pos' : 'neg'), text: fmtPct(r.change_7d) }),
        el('td', { class: 'num', text: fmtUsd(r.mcap_usd) }),
        el('td', { class: 'num', text: r.mcap_usd && r.tvl_usd ? (r.mcap_usd / r.tvl_usd).toFixed(2) + '\u00d7 TVL' : 'n/a' }),
        el('td', null, el('span', { class: 'status', text: 'already trades' }))
      ));
    });
    return el('div', { class: 'panel' },
      el('div', { class: 'table-wrap' },
        el('table', null,
          el('caption', { class: 'sub', text: 'Token live: these protocols already trade, so their market cap is a fact, not a model. The mcap/TVL ratio of each feeds the category factor the pre-token board scores with.' }),
          el('thead', null, el('tr', null, el('th', { scope: 'col', text: 'Status' }), el('th', { scope: 'col', text: 'Protocol' }), el('th', { scope: 'col', text: 'TVL' }), el('th', { scope: 'col', text: '7d' }), el('th', { scope: 'col', text: 'Market cap' }), el('th', { scope: 'col', text: 'Mcap / TVL' }), el('th', { scope: 'col', text: 'Token' }))),
          tbody
        )
      )
    );
  }

  function modelPanel() {
    var m = DATA.model;
    var mults = DATA.category_mults || {};
    var keys = Object.keys(mults).sort(function (a, b) { return mults[b] - mults[a]; });
    return el('section', { class: 'panel model' },
      el('h2', { text: 'How implied value is computed' }),
      el('p', { class: 'sub', text: 'Every row is scored by one function of the snapshot figures. No protocol name is special-cased, and no row is hand-picked.' }),
      el('div', { class: 'formula' },
        'implied = round( tvl_usd \u00d7 ' + m.base_multiple + ' \u00d7 (1 + clamp(change_7d, ' + m.growth_floor + ', ' + m.growth_cap + ')/100 \u00d7 ' + m.growth_weight + ') \u00d7 (1 + min(age_days, ' + m.age_days + ')/' + m.age_days + ' \u00d7 ' + m.age_weight + ') \u00d7 category )'
      ),
      el('p', { class: 'sub', text: 'The category factor is measured from the snapshot itself: the median market-cap-to-TVL ratio of the live-token protocols in the same category (shown below, capped at ' + m.category_mult_cap + '), so what a token in that sector has been worth against its TVL sets what a pre-token one may imply. An unlisted age uses ' + m.unknown_age_days + ' days.' }),
      el('div', { class: 'mults' }, keys.map(function (k) {
        return el('span', { class: 'chip', 'aria-pressed': 'false', text: k + ' \u00d7' + mults[k] });
      }))
    );
  }

  var dialog = el('dialog', { class: 'detail', id: 'detail', 'aria-labelledby': 'detail-title' });
  dialog.addEventListener('close', function () { state.selected = null; writeHash(); });

  function openDetail(slug) {
    var row = DATA.rows.filter(function (r) { return r.slug === slug; })[0];
    if (!row) return;
    state.selected = slug;
    writeHash();
    dialog.textContent = '';
    var steps = farmSteps(row);
    var recheck = impliedOf(row, DATA.model);
    dialog.appendChild(el('div', { class: 'detail-head' },
      el('div', null,
        el('span', { class: 'brand-name', text: 'Rank ' + row.rank + ' of ' + DATA.board_size }),
        el('h2', { id: 'detail-title', text: row.name }),
        el('p', { class: 'sub', text: (row.category || 'Other') + ' on ' + (row.chains && row.chains.length ? row.chains.join(', ') : 'an unnamed chain') + ' \u00b7 listed ' + (row.listed_at || 'date unknown') })
      ),
      el('button', { class: 'close', type: 'button', 'aria-label': 'Close details', text: 'Close', onclick: function () { dialog.close(); } })
    ));
    dialog.appendChild(el('section', { class: 'detail-section' },
      el('h3', { text: 'Implied value' }),
      el('div', { class: 'equation' },
        el('div', null, el('span', { text: 'TVL' }), el('b', { class: 'num', text: fmtUsd(row.tvl_usd) })),
        el('div', null, el('span', { text: 'Seven-day growth' }), el('b', { class: 'num', text: fmtPct(row.change_7d) })),
        el('div', null, el('span', { text: 'Age with no token' }), el('b', { class: 'num', text: fmtAge(row.age_days) })),
        el('div', null, el('span', { text: 'Growth multiplier' }), el('b', { class: 'num', text: '\u00d7' + row.growth_multiplier })),
        el('div', null, el('span', { text: 'Age multiplier' }), el('b', { class: 'num', text: '\u00d7' + row.age_multiplier })),
        el('div', null, el('span', { text: 'Category multiplier' }), el('b', { class: 'num', text: '\u00d7' + row.category_multiplier })),
        el('div', { class: 'total' }, el('span', { text: 'Implied value' }), el('b', { class: 'num', text: fmtUsd(row.implied_value_usd) }))
      ),
      spark(row),
      el('p', { class: 'sub', style: 'margin-top:12px', text: 'Model ' + DATA.model_version + ': the same function scores every protocol. The page recomputes this row as ' + fmtUsd(recheck) + (recheck === row.implied_value_usd ? ', the same number board.json carries.' : ', which differs from the board: the data would be stale.') + ' This is an estimate, not a price.' })
    ));
    dialog.appendChild(el('section', { class: 'detail-section' },
      el('h3', { text: 'Risk panel' }),
      el('div', { class: 'risk' }, riskRows(row).map(function (x) {
        return el('div', { class: 'risk-row' },
          el('span', { text: x.label }),
          el('div', { class: 'gauge', 'aria-hidden': 'true' }, el('i', { class: x.cls, style: 'width:' + x.pct + '%' })),
          el('b', { text: x.text })
        );
      })),
      el('p', { class: 'sub', style: 'margin-top:10px', text: 'Each gauge is read straight from the snapshot: TVL depth, the seven-day change, and how long the protocol has run with no token.' })
    ));
    dialog.appendChild(el('section', { class: 'detail-section' },
      el('h3', { text: 'Farm plan' }),
      el('ol', { class: 'steps' }, steps.map(function (s) {
        var at = s.indexOf(' Cost: ');
        var action = at >= 0 ? s.slice(0, at) : s;
        var tail = at >= 0 ? s.slice(at + 1) : '';
        return el('li', null, el('b', { text: action }), el('span', { class: 'cost', text: tail }));
      }))
    ));
    if (typeof dialog.showModal === 'function') {
      if (!dialog.open) dialog.showModal();
    } else {
      dialog.setAttribute('open', '');
    }
  }

  function render() {
    app.textContent = '';
    var shell = el('div', { class: 'shell' });
    shell.appendChild(header());
    shell.appendChild(lede());
    var categories = Array.from(new Set(DATA.rows.map(function (r) { return r.category || 'Other'; }))).sort();
    shell.appendChild(controls(categories));
    shell.appendChild(state.tab === 'pre-token' ? boardTable() : liveTable());
    if (state.tab === 'pre-token') shell.appendChild(modelPanel());
    app.appendChild(shell);
    app.setAttribute('aria-busy', 'false');
    if (!dialog.isConnected) app.appendChild(dialog);
    if (state.selected) openDetail(state.selected);
  }

  readHash();
  render();
  window.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && dialog.open) dialog.close();
  });
})();
