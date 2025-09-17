(function () {
    const tabs = Array.from(document.querySelectorAll('.tab'));
    const panels = Array.from(document.querySelectorAll('.tab-panel'));
    function activateTab(btn, setFocus = true) {
        tabs.forEach(t => {
            t.classList.remove('active');
            t.setAttribute('aria-selected', 'false');
            t.setAttribute('tabindex', '-1');
        });
        panels.forEach(p => {
            p.classList.remove('active');
            p.toggleAttribute('hidden', true);
        });
        btn.classList.add('active');
        btn.setAttribute('aria-selected', 'true');
        btn.setAttribute('tabindex', '0');
        const panel = document.getElementById(btn.dataset.tab);
        panel.classList.add('active');
        panel.toggleAttribute('hidden', false);
        if (setFocus) btn.focus();
    }
    tabs.forEach(btn => btn.addEventListener('click', () => activateTab(btn, false)));
    const tablist = document.querySelector('[role="tablist"]');
    if (tablist) {
        tablist.addEventListener('keydown', (e) => {
            const currentIndex = tabs.findIndex(t => t.getAttribute('aria-selected') === 'true');
            let nextIndex = currentIndex;
            switch (e.key) {
                case 'ArrowRight':
                case 'Right':
                    nextIndex = (currentIndex + 1) % tabs.length; break;
                case 'ArrowLeft':
                case 'Left':
                    nextIndex = (currentIndex - 1 + tabs.length) % tabs.length; break;
                case 'Home': nextIndex = 0; break;
                case 'End': nextIndex = tabs.length - 1; break;
                default: return;
            }
            e.preventDefault();
            activateTab(tabs[nextIndex]);
        });
    }

    document.addEventListener('DOMContentLoaded', () => {
        // Fetch non-secret config for optional display or MSAL init
        fetch('/api/config')
            .then(r => r.json())
            .then(cfg => {
                window.__SMARTSCREEN_CONFIG__ = cfg;
                console.log('Config loaded', cfg);
            })
            .catch(() => { });

        const autoForm = document.getElementById('auto-form');
        const customForm = document.getElementById('custom-form');
        const summaryEl = document.getElementById('summary');
        const recEl = document.getElementById('recommendation');
        const loadingEl = document.getElementById('loading');
        const resultsSection = document.querySelector('.results');

        // UI Config (roles/domains/skills, limits) – YAML file uses JSON-compatible syntax
        const DEFAULT_UI_CONFIG = {
            roles: [
                { id: 'software-engineer', label: 'Software Engineer', skills: ['Data Structures', 'Algorithms', 'Git', 'Unit Testing', 'System Design'] },
                { id: 'data-scientist', label: 'Data Scientist', skills: ['Python', 'Pandas', 'NumPy', 'Statistics', 'Machine Learning'] },
                { id: 'devops-engineer', label: 'DevOps Engineer', skills: ['Docker', 'Kubernetes', 'CI/CD', 'Terraform', 'Linux'] },
                { id: 'product-manager', label: 'Product Manager', skills: ['Roadmapping', 'Backlog Management', 'User Research', 'Analytics', 'Stakeholder Communication'] },
                { id: 'java-developer', label: 'Java Developer', skills: ['Java', 'Spring', 'Hibernate', 'REST APIs', 'Microservices'] },
            ],
            domains: ['Web', 'Cloud', 'AI/ML', 'Mobile'],
            skills: ['Python', 'JavaScript', 'React', 'Node.js', 'Azure', 'Docker', 'Kubernetes', 'SQL', 'NoSQL', 'Data Engineering', 'Java', 'Spring', 'Hibernate', 'REST APIs', 'Microservices', 'Pandas', 'NumPy', 'Statistics', 'Machine Learning', 'CI/CD', 'Terraform', 'Linux', 'Roadmapping', 'Backlog Management', 'User Research', 'Analytics', 'Stakeholder Communication', 'Data Structures', 'Algorithms', 'Git', 'Unit Testing', 'System Design'],
            limits: { maxSkills: 5 }
        };

        async function loadUIConfig() {
            try {
                const res = await fetch('config.yaml');
                const text = await res.text();
                // YAML 1.2 is a superset of JSON; our file is JSON-compatible
                return JSON.parse(text);
            } catch (e) {
                console.warn('Falling back to DEFAULT_UI_CONFIG. Could not load/parse config.yaml', e);
                return DEFAULT_UI_CONFIG;
            }
        }

        function clearOptions(sel) {
            while (sel.firstChild) sel.removeChild(sel.firstChild);
        }

        function buildOption(value, label) {
            const opt = document.createElement('option');
            opt.value = value;
            opt.textContent = label;
            return opt;
        }

        function populateUI(cfg) {
            const roleSel = customForm.querySelector('select[name="role"]');
            const domainSel = customForm.querySelector('select[name="domain"]');
            const skillsSel = customForm.querySelector('select[name="skills"]');
            // Update label with max skills
            const skillsLabel = skillsSel && skillsSel.previousElementSibling && skillsSel.previousElementSibling.tagName === 'LABEL' ? skillsSel.previousElementSibling : null;
            if (skillsLabel && cfg?.limits?.maxSkills) {
                skillsLabel.textContent = `Skills (max ${cfg.limits.maxSkills})`;
            }

            // Roles
            if (roleSel) {
                clearOptions(roleSel);
                cfg.roles.forEach(r => roleSel.appendChild(buildOption(r.label, r.label)));
            }
            // Domains
            if (domainSel) {
                clearOptions(domainSel);
                cfg.domains.forEach(d => domainSel.appendChild(buildOption(d, d)));
            }
            // Skills initial (All skills)
            if (skillsSel) {
                renderSkillsForRole(cfg, skillsSel, null);
                wireSkillLimit(skillsSel, cfg?.limits?.maxSkills ?? 5);
            }

            // Link role -> recommended skills group
            roleSel?.addEventListener('change', () => {
                renderSkillsForRole(cfg, skillsSel, roleSel.value);
            });
        }

        function renderSkillsForRole(cfg, skillsSel, roleLabel) {
            clearOptions(skillsSel);
            const container = document.createDocumentFragment();

            const role = cfg.roles.find(r => r.label === roleLabel);
            const recommended = role ? role.skills : [];
            const recommendedSet = new Set(recommended);

            if (recommended.length) {
                const group = document.createElement('optgroup');
                group.label = `Recommended for ${role.label}`;
                recommended.forEach(s => group.appendChild(buildOption(s, s)));
                container.appendChild(group);
            }

            const allGroup = document.createElement('optgroup');
            allGroup.label = 'All skills';
            cfg.skills
                .filter(s => !recommendedSet.has(s))
                .forEach(s => allGroup.appendChild(buildOption(s, s)));
            container.appendChild(allGroup);

            skillsSel.appendChild(container);
        }

        function wireSkillLimit(skillsSel, max) {
            // Track last clicked option to revert if limit exceeded
            let lastClickedValue = null;
            skillsSel.addEventListener('mousedown', (e) => {
                if (e.target && e.target.tagName === 'OPTION') {
                    lastClickedValue = e.target.value;
                }
            });
            // Inline message element
            let msgEl = skillsSel.parentElement.querySelector('.field-hint');
            if (!msgEl) {
                msgEl = document.createElement('div');
                msgEl.className = 'field-hint';
                msgEl.style.fontSize = '12px';
                msgEl.style.color = 'rgba(0,0,0,0.55)';
                msgEl.style.marginTop = '4px';
                skillsSel.parentElement.appendChild(msgEl);
            }
            function showHint(text) {
                msgEl.textContent = text || '';
                if (text) {
                    msgEl.style.color = 'rgb(160, 72, 58)';
                } else {
                    msgEl.style.color = 'rgba(0,0,0,0.55)';
                }
            }
            skillsSel.addEventListener('change', () => {
                const selected = Array.from(skillsSel.selectedOptions);
                if (selected.length > max) {
                    // Deselect the last clicked or the last option
                    const last = selected.find(o => o.value === lastClickedValue) || selected[selected.length - 1];
                    if (last) last.selected = false;
                    showHint(`You can select up to ${max} skills.`);
                } else {
                    showHint('');
                }
            });
        }

        loadUIConfig().then(populateUI);

        // Enhance dropzone hint interactions
        function wireDropzone(labelEl, inputEl) {
            if (!labelEl || !inputEl) return;
            const prevent = e => { e.preventDefault(); e.stopPropagation(); };
            ['dragenter', 'dragover'].forEach(evt => labelEl.addEventListener(evt, e => { prevent(e); labelEl.classList.add('dragover'); }));
            ['dragleave', 'drop'].forEach(evt => labelEl.addEventListener(evt, e => { prevent(e); labelEl.classList.remove('dragover'); }));
            labelEl.addEventListener('drop', e => {
                if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length) {
                    const file = e.dataTransfer.files[0];
                    inputEl.files = e.dataTransfer.files;
                    labelEl.classList.add('has-file');
                    labelEl.querySelector('.dz-title').textContent = file.name;
                    labelEl.querySelector('.dz-sub').textContent = 'Ready to upload';
                }
            });
            inputEl.addEventListener('change', () => {
                const file = inputEl.files && inputEl.files[0];
                if (file) {
                    labelEl.classList.add('has-file');
                    labelEl.querySelector('.dz-title').textContent = file.name;
                    labelEl.querySelector('.dz-sub').textContent = 'Ready to upload';
                } else {
                    labelEl.classList.remove('has-file');
                }
            });
        }
        wireDropzone(document.querySelector('label.dropzone-hint[for="resume-file"]'), document.getElementById('resume-file'));
        wireDropzone(document.querySelector('label.dropzone-hint[for="resume-file-custom"]'), document.getElementById('resume-file-custom'));

        async function submitForm(form, mode) {
            // Hide results during processing; show only after processed
            resultsSection?.classList.add('hidden');
            summaryEl.innerHTML = '';
            recEl.textContent = '';

            const formData = new FormData(form);
            formData.set('mode', mode);

            // Skills multiselect -> CSV
            if (mode === 'customized') {
                const sel = form.querySelector('select[name="skills"]');
                const selected = Array.from(sel.selectedOptions).map(o => o.value).slice(0, 5);
                formData.set('skills', selected.join(','));
            }

            try {
                const token = window.localStorage.getItem('msal_token') || '';
                const resp = await fetch('/api/screen-resume', {
                    method: 'POST',
                    headers: token ? { 'Authorization': `Bearer ${token}` } : {},
                    body: formData
                });
                if (!resp.ok) {
                    let detail = '';
                    try {
                        const err = await resp.json();
                        detail = (err && (err.detail || err.message)) || '';
                    } catch (_) {
                        detail = await resp.text();
                    }
                    let friendly;
                    switch (resp.status) {
                        case 401:
                            friendly = 'You must be signed in to use this feature. Please obtain a valid token.';
                            break;
                        case 413:
                            friendly = 'The file is too large. Please upload a PDF within the allowed size.';
                            break;
                        case 415:
                            friendly = 'Unsupported file type. Please upload a PDF file.';
                            break;
                        case 429:
                            friendly = 'You have reached the rate limit. Please wait a minute and try again.';
                            break;
                        default:
                            friendly = 'Request failed. Please try again.';
                    }
                    throw new Error(friendly + (detail ? `\nDetails: ${detail}` : ''));
                }
                const data = await resp.json();
                const summary = Array.isArray(data.summary) ? data.summary : [String(data.summary || '')];
                summaryEl.innerHTML = '';
                summary.forEach(item => {
                    const li = document.createElement('li');
                    li.textContent = item;
                    summaryEl.appendChild(li);
                });
                recEl.textContent = data.recommendation || '';
                // Show results after success
                resultsSection?.classList.remove('hidden');
            } catch (e) {
                summaryEl.innerHTML = '';
                recEl.textContent = 'Error: ' + (e && e.message ? e.message : 'Unknown error');
                // Also reveal results panel to show the error
                resultsSection?.classList.remove('hidden');
            } finally {
                // Do not auto-show loading; panel visibility handled above
                loadingEl.classList.add('hidden');
            }
        }

        autoForm.addEventListener('submit', (e) => {
            e.preventDefault();
            submitForm(autoForm, 'auto');
        });

        customForm.addEventListener('submit', (e) => {
            e.preventDefault();
            submitForm(customForm, 'customized');
        });
    }); // end DOMContentLoaded
})();