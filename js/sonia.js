const DB = {
    unidades: [],
    procedimentos: [],
    profissionais: [],
    exames: [],
    gruposExames: [],
    valoresExames: {}
};

const AppState = {
    config: { unidadeCnes: null, unidadeNome: null, competencia: null },
    escalas: [],
    examesSelecionadosTemp: [],
    grupoAtivo: null,
    todosSelecionados: false
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
    hiddenIsFinanceiro: document.getElementById('hiddenIsFinanceiro'),
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
        const [u, p, pr, e, v] = await Promise.all([
            fetch('unidades.csv').then(r => r.text()),
            fetch('procedimentos.csv').then(r => r.text()),
            fetch('profissionais.csv').then(r => r.text()),
            fetch('exames.csv').then(r => r.text()),
            fetch('valoresExames.csv').then(r => r.text())
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
            const tipoString = parts[2]?.trim().toUpperCase() || "";
            const regulado = parts[3]?.trim().toLowerCase() === 'sim';
            return { 
                codigo: cod, 
                nome: nome, 
                isRegulado: regulado, 
                isRetorno: nome.includes('RETORNO'),
                isFinanceiro: tipoString.includes('FINANCEIRO')
            };
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

        v.split('\n').slice(1).forEach(l => {
            const parts = l.split(';');
            if (parts.length >= 3) {
                const codMatch = parts[0].match(/\((\d+)\)/);
                if (codMatch) {
                    const cod = codMatch[1].padStart(7, '0');
                    DB.valoresExames[cod] = parseFloat(parts[2].trim()) || 0;
                }
            }
        });

        const linhasExames = e.split('\n').filter(l => l.trim());
        if (linhasExames.length > 0) {
            const cabecalho = linhasExames[0].split(';');
            cabecalho.forEach((col, index) => {
                const match = col.match(/\((\d+)\)/);
                if (match) {
                    DB.gruposExames.push({ codigo: match[1], nome: col, index: index });
                }
            });

            linhasExames.slice(1).forEach(linha => {
                const colunas = linha.split(';');
                colunas.forEach((conteudo, idx) => {
                    const desc = conteudo.trim();
                    if (desc) {
                        const matchExame = desc.match(/\((\d+)\)/);
                        if (matchExame) {
                            DB.exames.push({ codigo: matchExame[1], nome: desc, colIndex: idx });
                        }
                    }
                });
            });
        }

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

function calculateEndTime(startTime, minutes, vagas, isFinanceiro) {
    if (!startTime) return "";
    const [h, m] = startTime.split(':').map(Number);
    const date = new Date();
    date.setHours(h, m, 0, 0);

    if (isFinanceiro) {
        date.setMinutes(date.getMinutes() + 5);
    } else {
        if (!minutes || !vagas) return "";
        date.setMinutes(date.getMinutes() + (minutes * vagas));
    }

    let currentMin = date.getMinutes();
    if (currentMin % 5 !== 0) {
        date.setMinutes(currentMin + (5 - (currentMin % 5)));
    }

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
        els.hiddenIsFinanceiro.value = item.isFinanceiro;
        
        const codigoFormatado = item.codigo.padStart(7, '0');
        const grupo = DB.gruposExames.find(g => g.codigo.padStart(7, '0') === codigoFormatado);

        if (grupo) {
            AppState.grupoAtivo = grupo.index;
            els.rowExames.style.display = 'block';
        } else {
            AppState.grupoAtivo = null;
            els.rowExames.style.display = 'none';
            AppState.examesSelecionadosTemp = [];
            AppState.todosSelecionados = false;
            renderExameTags();
        }
    });
}

els.btnAbrirExames.onclick = () => {
    if (AppState.grupoAtivo === null) return;
    const examesDoGrupo = DB.exames.filter(ex => ex.colIndex === AppState.grupoAtivo);
    
    els.modalCorpo.innerHTML = `
        <label style="background: #eff6ff; font-weight: bold; border-bottom: 1px solid #dbeafe; margin-bottom: 10px;">
            <input type="checkbox" id="checkTodosExames" ${AppState.todosSelecionados ? 'checked' : ''}> SELECIONAR TODOS
        </label>
    `;
    
    examesDoGrupo.forEach(ex => {
        const isChecked = AppState.examesSelecionadosTemp.some(s => s.codigo === ex.codigo);
        const label = document.createElement('label');
        label.innerHTML = `<input type="checkbox" class="check-exame-item" value="${ex.codigo}" data-nome="${ex.nome}" ${isChecked ? 'checked' : ''}> ${ex.nome}`;
        els.modalCorpo.appendChild(label);
    });

    const checkTodos = document.getElementById('checkTodosExames');
    checkTodos.onchange = (e) => {
        document.querySelectorAll('.check-exame-item').forEach(cb => cb.checked = e.target.checked);
    };

    els.modalExames.style.display = 'flex';
};

window.fecharModalExames = () => { els.modalExames.style.display = 'none'; };

window.confirmarSelecaoExames = () => {
    const todos = document.getElementById('checkTodosExames').checked;
    AppState.todosSelecionados = todos;
    
    if (todos) {
        AppState.examesSelecionadosTemp = [{ codigo: "TODOS", nome: "TODOS OS EXAMES DO GRUPO" }];
    } else {
        const selecionados = [];
        document.querySelectorAll('.check-exame-item:checked').forEach(cb => {
            selecionados.push({ codigo: cb.value, nome: cb.getAttribute('data-nome') });
        });
        AppState.examesSelecionadosTemp = selecionados;
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
    if (codigo === "TODOS") AppState.todosSelecionados = false;
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

    const cpfInformado = els.hiddenCpfProfissional.value;
    const profissionalValido = DB.profissionais.find(p => 
        p.cpf === cpfInformado && 
        p.unidadeNome === AppState.config.unidadeNome && 
        p.status === "ATIVO"
    );

    if (!profissionalValido || !els.inputProfissional.value.includes(cpfInformado)) {
        alert("Erro: Selecione um Profissional da lista de sugestões. Nomes digitados manualmente não são permitidos.");
        els.inputProfissional.focus();
        return;
    }

    const dias = Array.from(document.querySelectorAll('input[name="dias"]:checked')).map(cb => cb.value);
    if(dias.length === 0) return alert("Selecione ao menos um dia.");
    const vagas = parseInt(els.numVagas.value);
    const minutos = parseInt(els.numMinutos.value);
    const isFinanceiro = els.hiddenIsFinanceiro.value === 'true';
    const hFim = calculateEndTime(els.horaInicio.value, minutos, vagas, isFinanceiro);

    let examesString = "";
    if (AppState.todosSelecionados) {
        examesString = "TODOS";
    } else {
        examesString = AppState.examesSelecionadosTemp.map(x => x.codigo).join(' ');
    }

    let vagasCSV = vagas;
    if (isFinanceiro) {
        const codP = els.hiddenCodProcedimento.value.padStart(7, '0');
        const valorFinanceiro = DB.valoresExames[codP] || 0;
        vagasCSV = (vagas * valorFinanceiro).toFixed(2);
    }

    const linha = {
        ups: AppState.config.unidadeCnes,
        pa: els.hiddenCodProcedimento.value,
        procedimento: els.inputProcedimento.value.split(' - ')[1] || els.inputProcedimento.value,
        cpf: els.hiddenCpfProfissional.value,
        profissional: profissionalValido.nome,
        dias: dias.join(' '),
        horario: `${els.horaInicio.value} às ${hFim}`,
        hIni: els.horaInicio.value,
        hFim: hFim,
        vagas: vagas,
        vagasCSV: vagasCSV,
        escala: els.tipoEscala.value === '0' ? 'Chegada' : 'Agendado',
        st_quebra: els.tipoEscala.value,
        minutos: minutos,
        agenda: els.tipoAgenda.value === '0' ? 'Rede' : 'Local',
        tp_agenda: els.tipoAgenda.value,
        exames: examesString,
        vini: document.getElementById('vigenciaInicio').value.split('-').reverse().join('/'),
        vfim: document.getElementById('vigenciaFim').value.split('-').reverse().join('/')
    };

    AppState.escalas.push(linha);
    localStorage.setItem('SONIA_DATA', JSON.stringify(AppState.escalas));
    renderTable();
    els.formEscala.reset();
    AppState.examesSelecionadosTemp = [];
    AppState.grupoAtivo = null;
    AppState.todosSelecionados = false;
    els.rowExames.style.display = 'none';
    renderExameTags();
    els.hiddenCpfProfissional.value = "";
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
        csv += `${l.ups};${l.pa};${l.cpf};1;${l.vini};${l.vfim};${l.st_quebra};${l.tp_agenda};1;${l.dias};${l.hIni};${l.hFim};${l.vagasCSV};${l.minutos};0;0;0;0;${l.exames};ESCALAS_${AppState.config.competencia}_2026\n`;
    });
    
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `ESCALAS_${AppState.config.unidadeNome}_${AppState.config.competencia}.csv`;
    link.click();

    AppState.escalas = [];
    localStorage.removeItem('SONIA_DATA');
    renderTable();
    alert("Escalas exportadas com sucesso! A tabela foi limpa.");
};

document.addEventListener('DOMContentLoaded', () => {
    loadCSVData().then(initAutocompletes);
    const saved = localStorage.getItem('SONIA_DATA');
    if (saved) { AppState.escalas = JSON.parse(saved); renderTable(); }
});
