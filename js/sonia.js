const DB = {
    unidades: [],
    procedimentos: [],
    profissionais: [],
    exames: [],
    gruposExames: [] 
};

const AppState = {
    config: { unidadeCnes: null, unidadeNome: null, competencia: null },
    escalas: [],
    examesSelecionadosTemp: []
};

const els = {
    screenWelcome: document.getElementById('screen-welcome'),
    screenApp: document.getElementById('screen-app'),
    formConfig: document.getElementById('formConfig'),
    configUnidade: document.getElementById('configUnidade'),
    listUnidades: document.getElementById('listUnidades'),
    hiddenCnes: document.getElementById('hiddenCnes'),
    configCompetencia: document.getElementById('configCompetencia'),
    btnIniciar: document.getElementById('btnIniciar'),
    displayUnidade: document.getElementById('displayUnidade'),
    displayCompetencia: document.getElementById('displayCompetencia'),
    btnVoltar: document.getElementById('btnVoltar'),
    formEscala: document.getElementById('formEscala'),
    inputProcedimento: document.getElementById('inputProcedimento'),
    listProcedimentos: document.getElementById('listProcedimentos'),
    hiddenCodProcedimento: document.getElementById('hiddenCodProcedimento'),
    hiddenIsRegulado: document.getElementById('hiddenIsRegulado'),
    hiddenIsRetorno: document.getElementById('hiddenIsRetorno'),
    inputProfissional: document.getElementById('inputProfissional'),
    listProfissionais: document.getElementById('listProfissionais'),
    hiddenCpfProfissional: document.getElementById('hiddenCpfProfissional'),
    tipoEscala: document.getElementById('tipoEscala'),
    tipoAgenda: document.getElementById('tipoAgenda'),
    numMinutos: document.getElementById('numMinutos'),
    numVagas: document.getElementById('numVagas'),
    horaInicio: document.getElementById('horaInicio'),
    horaFim: document.getElementById('horaFim'),
    rowExames: document.getElementById('rowExames'),
    inputExames: document.getElementById('inputExames'),
    listExames: document.getElementById('listExames'),
    tagsExames: document.getElementById('tagsExames'),
    tabelaBody: document.querySelector('#tabelaDados tbody'),
    btnLimpar: document.getElementById('btnLimpar'),
    btnExportar: document.getElementById('btnExportar')
};

function switchScreen(screenName) {
    if (screenName === 'app') {
        els.screenWelcome.classList.remove('active');
        els.screenApp.classList.add('active');
        localStorage.setItem('SONIA_SESSION_ACTIVE', 'true');
    } else {
        els.screenApp.classList.remove('active');
        els.screenWelcome.classList.add('active');
        localStorage.removeItem('SONIA_SESSION_ACTIVE');
        localStorage.removeItem('SONIA_CONFIG');
    }
}

async function loadCSVData() {
    try {
        const [u, p, pr, e] = await Promise.all([
            fetch('unidades.csv').then(r => r.text()),
            fetch('procedimentos.csv').then(r => r.text()),
            fetch('profissionais.csv').then(r => r.text()),
            fetch('exames.csv').then(r => r.text())
        ]);

        DB.unidades = u.split('\n').slice(1).map(l => l.trim()).filter(l => l).map(l => {
            const parts = l.split(';');
            return { cnes: parts[0]?.trim(), nome: parts[1]?.trim() };
        });

        DB.procedimentos = p.split('\n').slice(1).map(l => l.trim()).filter(l => l).map(l => {
            const parts = l.split(';');
            const cod = parts[0]?.trim();
            const nomeRaw = parts[1]?.trim() || "";
            const nome = nomeRaw.replace(/"/g, '');
            const regulado = parts[3]?.trim().toLowerCase() === 'sim';
            return { codigo: cod, nome: nome, isRegulado: regulado, isRetorno: nome.includes('RETORNO') };
        });

        DB.profissionais = pr.split('\n').slice(1).map(l => l.trim()).filter(l => l).map(l => {
            const parts = l.split(';');
            return { 
                cpf: parts[0]?.trim(), 
                nome: parts[1]?.trim(), 
                unidadeNome: parts[2]?.trim(), 
                status: parts[3]?.trim()?.toUpperCase() 
            };
        });

        const linhasExames = e.split('\n').filter(l => l.trim());
        if (linhasExames.length > 0) {
            const cabecalho = linhasExames[0];
            const gruposMatch = cabecalho.match(/\((\d+)\)/g);
            if (gruposMatch) {
                DB.gruposExames = gruposMatch.map(m => m.replace(/\(|\)/g, ''));
            }
        }

        DB.exames = linhasExames.slice(1).map(l => {
            const parts = l.split(';');
            const desc = parts[26] || "";
            const match = desc.match(/\((\d+)\)/);
            return { codigo: match ? match[1] : null, nome: desc.trim() };
        }).filter(ex => ex.codigo && ex.nome);

        els.btnIniciar.textContent = "Iniciar Nova Escala";
        
        checkSession();
    } catch (err) {
        console.error("Erro CSV:", err);
        els.btnIniciar.textContent = "Erro ao carregar arquivos";
    }
}

function checkSession() {
    const sessionActive = localStorage.getItem('SONIA_SESSION_ACTIVE');
    const savedConfig = localStorage.getItem('SONIA_CONFIG');
    
    if (sessionActive === 'true' && savedConfig) {
        AppState.config = JSON.parse(savedConfig);
        els.displayUnidade.textContent = `${AppState.config.unidadeCnes} - ${AppState.config.unidadeNome}`;
        els.displayCompetencia.textContent = AppState.config.competencia;
        switchScreen('app');
    }
}

function calculateEndTime(startTime, minutes, vagas) {
    if (!startTime || !minutes || !vagas) return "";
    const [h, m] = startTime.split(':').map(Number);
    const date = new Date();
    date.setHours(h, m, 0, 0);
    date.setMinutes(date.getMinutes() + (minutes * vagas));
    return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function setupAutocomplete(inputEl, listEl, dataOrFunction, displayKey, valueKey, onSelect) {
    inputEl.addEventListener('input', (e) => {
        const term = e.target.value.toUpperCase();
        listEl.innerHTML = '';
        if (term.length < 1) { listEl.style.display = 'none'; return; }
        const sourceData = (typeof dataOrFunction === 'function') ? dataOrFunction() : dataOrFunction;
        const filtered = sourceData.filter(item => {
            const val = (item[valueKey] || "").toString().toUpperCase();
            const disp = (item[displayKey] || "").toString().toUpperCase();
            return val.includes(term) || disp.includes(term);
        }).slice(0, 15);
        if (filtered.length > 0) {
            listEl.style.display = 'block';
            filtered.forEach(item => {
                const div = document.createElement('div');
                div.className = 'autocomplete-item';
                div.innerHTML = `<strong>${item[valueKey]}</strong> - ${item[displayKey]}`;
                div.onclick = () => { 
                    inputEl.value = `${item[valueKey]} - ${item[displayKey]}`; 
                    onSelect(item); 
                    listEl.style.display = 'none'; 
                };
                listEl.appendChild(div);
            });
        } else { listEl.style.display = 'none'; }
    });
    document.addEventListener('click', (e) => { if (e.target !== inputEl) listEl.style.display = 'none'; });
}

function initAutocompletes() {
    setupAutocomplete(els.configUnidade, els.listUnidades, DB.unidades, 'nome', 'cnes', (item) => {
        els.hiddenCnes.value = item.cnes;
        AppState.config.unidadeCnes = item.cnes;
        AppState.config.unidadeNome = item.nome;
    });
    
    setupAutocomplete(els.inputProfissional, els.listProfissionais, () => {
        return DB.profissionais.filter(p => p.unidadeNome === AppState.config.unidadeNome && p.status === "ATIVO");
    }, 'nome', 'cpf', (item) => {
        els.hiddenCpfProfissional.value = item.cpf;
    });

    setupAutocomplete(els.inputProcedimento, els.listProcedimentos, DB.procedimentos, 'nome', 'codigo', (item) => {
        els.hiddenCodProcedimento.value = item.codigo;
        els.hiddenIsRegulado.value = item.isRegulado;
        els.hiddenIsRetorno.value = item.isRetorno;
        
        const codigoFormatado = item.codigo.padStart(7, '0');
        const grupoEncontrado = DB.gruposExames.some(g => g.padStart(7, '0') === codigoFormatado);

        if (grupoEncontrado) {
            els.rowExames.style.display = 'flex';
            els.inputExames.disabled = false;
        } else {
            els.rowExames.style.display = 'none';
            AppState.examesSelecionadosTemp = [];
            renderExameTags();
        }
    });

    setupAutocomplete(els.inputExames, els.listExames, DB.exames, 'nome', 'codigo', (item) => {
        if (!AppState.examesSelecionadosTemp.find(x => x.codigo === item.codigo)) {
            AppState.examesSelecionadosTemp.push(item);
            renderExameTags();
        }
        els.inputExames.value = '';
    });
}

function renderExameTags() {
    els.tagsExames.innerHTML = '';
    AppState.examesSelecionadosTemp.forEach(ex => {
        const span = document.createElement('span');
        span.className = 'tag';
        span.innerHTML = `${ex.codigo} <span class="tag-remove" onclick="removeExameTag('${ex.codigo}')">&times;</span>`;
        els.tagsExames.appendChild(span);
    });
}

window.removeExameTag = (codigo) => {
    AppState.examesSelecionadosTemp = AppState.examesSelecionadosTemp.filter(e => e.codigo !== codigo);
    renderExameTags();
};

els.tipoEscala.addEventListener('change', (e) => {
    if (e.target.value === "0") {
        els.numMinutos.value = 1;
        els.numMinutos.readOnly = true;
    } else {
        els.numMinutos.readOnly = false;
        els.numMinutos.value = "";
    }
});

els.formConfig.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!els.hiddenCnes.value) return alert("Selecione uma Unidade válida.");
    AppState.config.competencia = els.configCompetencia.value;
    localStorage.setItem('SONIA_CONFIG', JSON.stringify(AppState.config));
    els.displayUnidade.textContent = `${els.hiddenCnes.value} - ${AppState.config.unidadeNome}`;
    els.displayCompetencia.textContent = AppState.config.competencia;
    switchScreen('app');
});

els.btnVoltar.onclick = () => { if(confirm("Sair e trocar unidade?")) switchScreen('welcome'); };

els.formEscala.addEventListener('submit', (e) => {
    e.preventDefault();
    const dias = Array.from(document.querySelectorAll('input[name="dias"]:checked')).map(cb => cb.value);
    if(dias.length === 0) return alert("Selecione ao menos um dia.");
    const vagas = parseInt(els.numVagas.value);
    const minutos = parseInt(els.numMinutos.value);
    const hFim = calculateEndTime(els.horaInicio.value, minutos, vagas);

    const linha = {
        ups: AppState.config.unidadeCnes,
        pa: els.hiddenCodProcedimento.value,
        procedimento: els.inputProcedimento.value.split(' - ')[1] || els.inputProcedimento.value,
        cpf: els.hiddenCpfProfissional.value,
        profissional: els.inputProfissional.value.split(' - ')[1] || els.inputProfissional.value,
        dias: dias.join(' '),
        horario: `${els.horaInicio.value} às ${hFim}`,
        hIni: els.horaInicio.value,
        hFim: hFim,
        vagas: vagas,
        escala: els.tipoEscala.value === '0' ? 'Chegada' : 'Agendado',
        st_quebra: els.tipoEscala.value,
        minutos: minutos,
        agenda: els.tipoAgenda.value === '0' ? 'Rede' : 'Local',
        tp_agenda: els.tipoAgenda.value,
        exames: AppState.examesSelecionadosTemp.map(x => x.codigo).join(' '),
        vini: document.getElementById('vigenciaInicio').value.split('-').reverse().join('/'),
        vfim: document.getElementById('vigenciaFim').value.split('-').reverse().join('/')
    };

    AppState.escalas.push(linha);
    localStorage.setItem('SONIA_DATA', JSON.stringify(AppState.escalas));
    renderTable();
    els.formEscala.reset();
    AppState.examesSelecionadosTemp = [];
    renderExameTags();
});

function renderTable() {
    els.tabelaBody.innerHTML = '';
    AppState.escalas.forEach((l, i) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${l.pa}<br><small>${l.procedimento}</small></td><td>${l.cpf}<br><small>${l.profissional}</small></td><td>${l.dias}</td><td>${l.horario}</td><td>${l.vagas}</td><td>${l.escala}</td><td>${l.minutos}</td><td>${l.agenda}</td><td>${l.exames || '-'}</td><td><button class="btn-trash" onclick="deleteLinha(${i})">🗑️</button></td>`;
        els.tabelaBody.appendChild(tr);
    });
}

window.deleteLinha = (i) => { AppState.escalas.splice(i, 1); localStorage.setItem('SONIA_DATA', JSON.stringify(AppState.escalas)); renderTable(); };

els.btnLimpar.onclick = () => { if(confirm("Limpar tudo?")) { AppState.escalas = []; localStorage.removeItem('SONIA_DATA'); renderTable(); } };

els.btnExportar.onclick = () => {
    if (AppState.escalas.length === 0) return alert("Tabela vazia.");
    let csv = "ups;pa;cpf;st_vigencia;dt_vigencia_inicial;dt_vigencia_final;st_quebra;tp_agenda;st_ativo;dia;hora_inicial;hora_final;fichas;fichas_min;retornos;retornos_min;reservas;reservas_min;v_pa_item;ds_observacao\n";
    AppState.escalas.forEach(l => {
        csv += `${l.ups};${l.pa};${l.cpf};1;${l.vini};${l.vfim};${l.st_quebra};${l.tp_agenda};1;${l.dias};${l.hIni};${l.hFim};${l.vagas};${l.minutos};0;0;0;0;${l.exames};ESCALAS_${AppState.config.competencia}_2026\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `ESCALAS_${AppState.config.unidadeNome}_${AppState.config.competencia}.csv`;
    link.click();
};

document.addEventListener('DOMContentLoaded', () => {
    loadCSVData().then(initAutocompletes);
    const saved = localStorage.getItem('SONIA_DATA');
    if (saved) { AppState.escalas = JSON.parse(saved); renderTable(); }
});
