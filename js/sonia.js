const DB = {
    unidades: [],
    masterData: {},
    profissionais: []
};

const AppState = {
    config: { unidadeCnes: null, unidadeNome: null, competencia: null },
    escalas: [],
    examesSelecionadosTemp: [],
    procedimentoAtivo: null,
    todosSelecionados: false,
    stringExamesHabilitados: null,
    examesHabilitadosFull: []
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
    btnAbrirExames: document.getElementById('btnAbrirExames'),
    modalExames: document.getElementById('modalExames'),
    modalCorpo: document.getElementById('modalCorpo'),
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
        const [pu, pr] = await Promise.all([
            fetch('procedimentos_unidades.csv').then(r => r.text()),
            fetch('profissionais.csv').then(r => r.text())
        ]);

        const linhas = pu.split('\n').slice(1);
        const unidadesMap = new Map();

        linhas.forEach(linha => {
            if (!linha.trim()) return;
            const col = linha.split(';');
            const cnes = col[0]?.trim();
            const unidadeNome = col[1]?.trim();
            const codProc = col[2]?.trim();
            const descProc = col[3]?.trim();
            const codSub = col[4]?.trim();
            const descSub = col[5]?.trim();
            const tipo = col[6]?.trim().toUpperCase();
            const regulado = col[7]?.trim().toLowerCase() === 'sim';
            const valor = parseFloat(col[8]?.toString().replace(',', '.')) || 0;

            if (!cnes || !codProc) return;

            if (!DB.masterData[cnes]) {
                DB.masterData[cnes] = { nome: unidadeNome, procedimentos: {} };
                unidadesMap.set(cnes, unidadeNome);
            }

            if (!DB.masterData[cnes].procedimentos[codProc]) {
                DB.masterData[cnes].procedimentos[codProc] = {
                    codigo: codProc.padStart(7, '0'),
                    nome: descProc,
                    tipo: tipo,
                    regulado: regulado,
                    valorGeral: valor, 
                    subitens: []
                };
            }

            if (codSub) {
                DB.masterData[cnes].procedimentos[codProc].subitens.push({
                    codigo: codSub.padStart(7, '0'),
                    nome: descSub,
                    valor: valor
                });
            }
        });

        DB.unidades = Array.from(unidadesMap).map(([cnes, nome]) => ({ cnes: cnes.padStart(7, '0'), nome }));
        DB.profissionais = pr.split('\n').slice(1).map(l => l.trim()).filter(l => l).map(l => {
            const parts = l.split(';');
            return { 
                cpf: parts[0]?.trim().padStart(11, '0'), 
                nome: parts[1]?.trim(), 
                unidadeNome: parts[2]?.trim(), 
                status: parts[3]?.trim()?.toUpperCase() 
            };
        });

        els.btnIniciar.textContent = "Iniciar Nova Escala";
        checkSession();
    } catch (err) {
        console.error("Erro ao carregar dados:", err);
        els.btnIniciar.textContent = "Erro nos arquivos";
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

function calculateEndTime(startTime, minutes, vagas, aplicaRegraFinanceiro) {
    if (!startTime) return "";
    const [h, m] = startTime.split(':').map(Number);
    const date = new Date();
    date.setHours(h, m, 0, 0);
    if (aplicaRegraFinanceiro) date.setMinutes(date.getMinutes() + 5);
    else {
        if (!minutes || !vagas) return "";
        date.setMinutes(date.getMinutes() + (minutes * vagas));
    }
    let currentMin = date.getMinutes();
    let remainder = currentMin % 5;
    if (remainder !== 0) date.setMinutes(currentMin + (5 - remainder));
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
        }).slice(0, 35);
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
}

function initAutocompletes() {
    setupAutocomplete(els.configUnidade, els.listUnidades, DB.unidades, 'nome', 'cnes', (item) => {
        els.hiddenCnes.value = item.cnes.padStart(7, '0');
        AppState.config.unidadeCnes = item.cnes.padStart(7, '0');
        AppState.config.unidadeNome = item.nome;
    });
    
    setupAutocomplete(els.inputProfissional, els.listProfissionais, () => {
        return DB.profissionais.filter(p => p.unidadeNome === AppState.config.unidadeNome && p.status === "ATIVO");
    }, 'nome', 'cpf', (item) => {
        els.hiddenCpfProfissional.value = item.cpf.padStart(11, '0');
    });

    setupAutocomplete(els.inputProcedimento, els.listProcedimentos, () => {
        const cnes = AppState.config.unidadeCnes;
        if (!DB.masterData[cnes]) return [];
        return Object.values(DB.masterData[cnes].procedimentos);
    }, 'nome', 'codigo', (item) => {
        AppState.procedimentoAtivo = item;
        els.hiddenCodProcedimento.value = item.codigo.padStart(7, '0');
        els.hiddenIsRegulado.value = item.regulado;
        
        const isRetorno = item.nome.toUpperCase().includes('RETORNO');
        els.hiddenIsRetorno.value = isRetorno;
        
        if (isRetorno) {
            els.tipoAgenda.value = "1";
            els.tipoAgenda.disabled = true;
        } else {
            els.tipoAgenda.disabled = false;
        }

        if (item.tipo === 'FINANCEIRO') {
            els.tipoEscala.value = "0";
            els.tipoEscala.disabled = true;
            els.numMinutos.value = 1;
            els.numMinutos.readOnly = true;
        } else {
            els.tipoEscala.disabled = false;
            els.numMinutos.readOnly = false;
        }

        if (item.subitens && item.subitens.length > 0) {
            els.rowExames.style.display = 'block';
        } else {
            els.rowExames.style.display = 'none';
            AppState.examesSelecionadosTemp = [];
            AppState.todosSelecionados = false;
            renderExameTags();
        }
    });

    els.tipoEscala.addEventListener('change', () => {
        if (els.tipoEscala.value === "0") {
            els.numMinutos.value = 1;
            els.numMinutos.readOnly = true;
        } else {
            els.numMinutos.readOnly = false;
        }
    });

    els.horaInicio.addEventListener('blur', function() {
        if (!this.value) return;
        let [h, m] = this.value.split(':').map(Number);
        let remainder = m % 5;
        if (remainder !== 0) {
            m = Math.round(m / 5) * 5;
            if (m === 60) { h = (h + 1) % 24; m = 0; }
            this.value = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
        }
    });
}

els.btnAbrirExames.onclick = () => {
    if (!AppState.procedimentoAtivo || !AppState.procedimentoAtivo.subitens) return;
    els.modalCorpo.innerHTML = `
        <label style="background: #eff6ff; font-weight: bold; border-bottom: 1px solid #dbeafe; margin-bottom: 10px;">
            <input type="checkbox" id="checkTodosExames" ${AppState.todosSelecionados ? 'checked' : ''}> SELECIONAR TODOS HABILITADOS
        </label>
    `;
    AppState.procedimentoAtivo.subitens.forEach(ex => {
        const isChecked = AppState.examesSelecionadosTemp.some(s => s.codigo === ex.codigo);
        const label = document.createElement('label');
        label.innerHTML = `<input type="checkbox" class="check-exame-item" value="${ex.codigo}" data-nome="${ex.nome}" data-valor="${ex.valor}" ${isChecked ? 'checked' : ''}> ${ex.nome} (R$ ${ex.valor})`;
        els.modalCorpo.appendChild(label);
    });
    document.getElementById('checkTodosExames').onchange = (e) => {
        document.querySelectorAll('.check-exame-item').forEach(cb => cb.checked = e.target.checked);
    };
    els.modalExames.style.display = 'flex';
};

window.fecharModalExames = () => { els.modalExames.style.display = 'none'; };

window.confirmarSelecaoExames = () => {
    const todos = document.getElementById('checkTodosExames').checked;
    AppState.todosSelecionados = todos;
    const selecionados = [];
    document.querySelectorAll('.check-exame-item:checked').forEach(cb => {
        selecionados.push({ 
            codigo: cb.value.padStart(7, '0'), 
            nome: cb.getAttribute('data-nome'),
            valor: parseFloat(cb.getAttribute('data-valor'))
        });
    });
    if (todos) {
        AppState.examesSelecionadosTemp = [{ codigo: "HABILITADOS", nome: "TODOS OS HABILITADOS", valor: 0 }];
        AppState.stringExamesHabilitados = selecionados.map(s => s.codigo.padStart(7, '0')).join(' ');
        AppState.examesHabilitadosFull = selecionados; 
    } else {
        AppState.examesSelecionadosTemp = selecionados;
        AppState.stringExamesHabilitados = null;
    }
    renderExameTags();
    fecharModalExames();
};

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
    if (codigo === "HABILITADOS") { AppState.todosSelecionados = false; AppState.stringExamesHabilitados = null; }
    renderExameTags();
};

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

    const vIniInput = document.getElementById('vigenciaInicio').value;
    const vFimInput = document.getElementById('vigenciaFim').value;
    if (vIniInput && vFimInput && new Date(vFimInput) < new Date(vIniInput)) {
        alert("Erro: Vigência Final menor que a Inicial.");
        return;
    }

    const cpf = els.hiddenCpfProfissional.value.padStart(11, '0');
    if (!cpf || cpf === "00000000000") return alert("Selecione um profissional.");

    const proc = AppState.procedimentoAtivo;
    if (!proc) return alert("Selecione um procedimento.");

    const dias = Array.from(document.querySelectorAll('input[name="dias"]:checked')).map(cb => cb.value);
    if(dias.length === 0) return alert("Selecione os dias da semana.");

    const hIni = els.horaInicio.value;
    if (!hIni) return alert("Informe o horário inicial.");

    // FILTRO DE CONFLITO DE HORÁRIO DO PROFISSIONAL
    const temConflito = AppState.escalas.some(esc => {
        const mesmoProfissional = esc.cpf === cpf;
        const mesmoProcedimento = esc.pa === proc.codigo;
        const mesmaVigencia = esc.vini === vIniInput.split('-').reverse().join('/') && esc.vfim === vFimInput.split('-').reverse().join('/');
        const mesmoHorario = esc.hIni === hIni;
        const diasEscalaSet = new Set(esc.dias.split(' '));
        const temDiaEmComum = dias.some(d => diasEscalaSet.has(d));

        return mesmoProfissional && mesmoProcedimento && mesmaVigencia && mesmoHorario && temDiaEmComum;
    });

    if (temConflito) {
        alert("Erro: Já existe uma escala para este profissional neste procedimento, dia e horário dentro da mesma vigência.");
        return;
    }

    const vagas = parseInt(els.numVagas.value);
    if (!vagas || vagas <= 0) return alert("Informe a quantidade de vagas.");

    const minutos = parseInt(els.numMinutos.value);
    const hFim = calculateEndTime(hIni, minutos, vagas, proc.tipo === 'FINANCEIRO');

    // LÓGICA DE CÁLCULO FINANCEIRO (REGRA SOLICITADA)
    let vagasParaCSV = vagas;

    if (proc.tipo === 'FINANCEIRO') {
        const listaParaCalculo = AppState.todosSelecionados ? AppState.examesHabilitadosFull : AppState.examesSelecionadosTemp;
        
        if (listaParaCalculo.length > 0) {
            const valores = listaParaCalculo.map(i => i.valor);
            const soma = valores.reduce((a, b) => a + b, 0);
            const media = soma / valores.length;
            const maiorValorSubitem = Math.max(...valores);

            const valorPropostoPelaMedia = vagas * media;
            const valorMinimoNecessario = 1 * maiorValorSubitem; // Regra: 1 * subitem mais caro

            if (valorPropostoPelaMedia < valorMinimoNecessario) {
                vagasParaCSV = Math.ceil(valorMinimoNecessario);
            } else {
                vagasParaCSV = Math.ceil(valorPropostoPelaMedia);
            }
        } else {
            vagasParaCSV = Math.ceil(vagas * proc.valorGeral);
        }
    }

    let examesCSV = AppState.todosSelecionados ? AppState.stringExamesHabilitados : AppState.examesSelecionadosTemp.map(x => x.codigo.padStart(7, '0')).join(' ');
    
    const linha = {
        ups: AppState.config.unidadeCnes.padStart(7, '0'),
        pa: proc.codigo.padStart(7, '0'),
        procedimento: proc.nome,
        cpf: cpf,
        profissional: els.inputProfissional.value.split(' - ')[1] || els.inputProfissional.value,
        dias: dias.join(' '),
        hIni: hIni,
        hFim: hFim,
        vagas: vagas,
        vagasCSV: vagasParaCSV,
        isRegulado: proc.regulado,
        isRetorno: els.hiddenIsRetorno.value === 'true',
        st_quebra: els.tipoEscala.value,
        tp_agenda: els.tipoAgenda.value,
        minutos: minutos,
        exames: examesCSV,
        vini: vIniInput.split('-').reverse().join('/'),
        vfim: vFimInput.split('-').reverse().join('/')
    };

    AppState.escalas.push(linha);
    localStorage.setItem('SONIA_DATA', JSON.stringify(AppState.escalas));
    renderTable();
    
    els.formEscala.reset();
    AppState.examesSelecionadosTemp = [];
    AppState.procedimentoAtivo = null;
    AppState.todosSelecionados = false;
    els.rowExames.style.display = 'none';
    renderExameTags();
    els.tipoAgenda.disabled = false;
});

function renderTable() {
    els.tabelaBody.innerHTML = '';
    AppState.escalas.forEach((l, i) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${l.pa}<br><small>${l.procedimento}</small></td>
            <td>${l.profissional}</td>
            <td>${l.dias}</td>
            <td>${l.hIni}-${l.hFim}</td>
            <td>${l.vagas}</td>
            <td>${l.st_quebra == '0' ? 'Chegada' : 'Horário'}</td>
            <td>${l.minutos}</td>
            <td>${l.tp_agenda == '0' ? 'Rede' : 'Local'}</td>
            <td>${l.exames || '-'}</td>
            <td><button class="btn-trash" onclick="deleteLinha(${i})">🗑️</button></td>
        `;
        els.tabelaBody.appendChild(tr);
    });
}

window.deleteLinha = (i) => { AppState.escalas.splice(i, 1); localStorage.setItem('SONIA_DATA', JSON.stringify(AppState.escalas)); renderTable(); };
els.btnLimpar.onclick = () => { if(confirm("Limpar tudo?")) { AppState.escalas = []; localStorage.removeItem('SONIA_DATA'); renderTable(); } };

els.btnExportar.onclick = () => {
    if (AppState.escalas.length === 0) return alert("Adicione dados primeiro.");
    
    let csv = "ups;pa;cpf;st_vigencia;dt_vigencia_inicial;dt_vigencia_final;st_quebra;tp_agenda;st_ativo;dia;hora_inicial;hora_final;fichas;fichas_min;retornos;retornos_min;reservas;reservas_min;v_pa_item;ds_observacao\n";
    
    let anoVigencia = "2026";
    if (AppState.escalas[0].vini) {
        const partes = AppState.escalas[0].vini.split('/');
        anoVigencia = partes[2];
    }

    AppState.escalas.forEach(l => {
        let f=0, fm=0, rt=0, rtm=0, rs=0, rsm=0;
        if (l.isRegulado) { rs=l.vagasCSV; rsm=l.minutos; }
        else if (l.tp_agenda === "1" || l.isRetorno) { rt=l.vagasCSV; rtm=l.minutos; }
        else { f=l.vagasCSV; fm=l.minutos; }

        const ups7 = l.ups.padStart(7, '0');
        const pa7 = l.pa.padStart(7, '0');
        const cpf11 = l.cpf.padStart(11, '0');
        
        // Formatar subitens com 7 dígitos
        const exames7 = l.exames ? l.exames.split(' ').map(e => e.padStart(7, '0')).join(' ') : "";

        csv += `${ups7};${pa7};${cpf11};1;${l.vini};${l.vfim};${l.st_quebra};${l.tp_agenda};1;${l.dias};${l.hIni};${l.hFim};${f};${fm};${rt};${rtm};${rs};${rsm};${exames7};SONIA_${AppState.config.competencia}\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    
    // Nome do arquivo: ESCALA_UNIDADE_COMPETENCIA_ANO.csv
    const nomeArquivo = `ESCALA_${AppState.config.unidadeNome.replace(/\s+/g, '_')}_${AppState.config.competencia}_${anoVigencia}.csv`;
    
    link.download = nomeArquivo;
    link.click();
    AppState.escalas = [];
    localStorage.removeItem('SONIA_DATA');
    renderTable();
};

document.addEventListener('DOMContentLoaded', () => {
    loadCSVData().then(initAutocompletes);
    const saved = localStorage.getItem('SONIA_DATA');
    if (saved) { AppState.escalas = JSON.parse(saved); renderTable(); }
});
