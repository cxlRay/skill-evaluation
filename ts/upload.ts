// @ts-nocheck
// ══════════════════════════════════════════════
// FILE UPLOAD
// ══════════════════════════════════════════════
const UZ=document.getElementById('upload-zone'), FI=document.getElementById('file-input');
UZ.addEventListener('dragover',e=>{e.preventDefault();UZ.classList.add('drag-over');});
UZ.addEventListener('dragleave',()=>UZ.classList.remove('drag-over'));
UZ.addEventListener('drop',e=>{e.preventDefault();UZ.classList.remove('drag-over');handleFiles(e.dataTransfer.files);});
FI.addEventListener('change',e=>handleFiles(e.target.files));

// 支持的文件类型
const SUPPORTED_EXTENSIONS = ['.md', '.skill', '.zip', '.benchmark.json', '.jsonl', '.chain.json', '.versions.json'];

function handleFiles(files) {
  Array.from(files).forEach(async f=>{
    const ext = '.' + f.name.split('.').pop().toLowerCase();
    const baseName = f.name.replace(ext, '');

    if (!SUPPORTED_EXTENSIONS.includes(ext)) {
      toast(`不支持的文件类型: ${f.name}`,'error');
      return;
    }

    if (ext === '.zip') {
      await handleZipFile(f);
    } else if (ext === '.benchmark.json' || ext === '.jsonl') {
      await handleBenchmarkFile(f);
    } else if (ext === '.chain.json') {
      await handleChainFile(f);
    } else if (ext === '.versions.json') {
      await handleVersionsFile(f);
    } else if (ext === '.md' || ext === '.skill') {
      handleMdFile(f);
    }
  });
}

// 处理 Benchmark 数据集文件
async function handleBenchmarkFile(f) {
  try {
    const content = await f.text();
    let benchmark;

    if (f.name.endsWith('.jsonl')) {
      // JSONL 格式: 每行一个测试用例
      const lines = content.split('\n').filter(l => l.trim());
      const testCases = lines.map((line, i) => {
        try {
          const obj = JSON.parse(line);
          return {
            id: obj.id || i + 1,
            prompt: obj.prompt || obj.input || obj.question,
            expected_output: obj.expected || obj.output || obj.answer,
            expectations: obj.expectations || (obj.answer ? [obj.answer] : []),
            category: obj.category || obj.type || 'general',
            difficulty: obj.difficulty || 'medium'
          };
        } catch {
          return null;
        }
      }).filter(Boolean);

      benchmark = {
        name: baseName,
        version: '1.0',
        test_cases: testCases
      };
    } else {
      // JSON 格式
      benchmark = JSON.parse(content);

      // 标准化格式
      if (!benchmark.test_cases && benchmark.tests) {
        benchmark.test_cases = benchmark.tests;
      }

      if (!benchmark.name) {
        benchmark.name = baseName;
      }
      if (!benchmark.version) {
        benchmark.version = '1.0';
      }
    }

    // 验证必要的字段
    if (!benchmark.test_cases || !Array.isArray(benchmark.test_cases)) {
      toast(`Benchmark 文件格式错误: ${f.name}`,'error');
      return;
    }

    // 添加到 benchmark 列表
    const existingIdx = benchmarks.findIndex(b => b.name === benchmark.name);
    if (existingIdx >= 0) {
      benchmarks[existingIdx] = { ...benchmark, file: f.name };
    } else {
      benchmarks.push({ ...benchmark, file: f.name });
    }

    renderBenchmarkList();
    toast(`已加载 Benchmark: ${benchmark.name} (${benchmark.test_cases.length} 个用例)`,'success');

  } catch (e) {
    console.error('Benchmark 解析失败:', e);
    toast(`解析失败: ${e.message}`,'error');
  }
}

// 处理链路配置文件
async function handleChainFile(f) {
  try {
    const content = await f.text();
    chainConfig = JSON.parse(content);

    if (!chainConfig.steps || !Array.isArray(chainConfig.steps)) {
      toast('Chain 配置格式错误','error');
      return;
    }

    toast(`已加载链路配置: ${chainConfig.steps.length} 个步骤`,'success');
  } catch (e) {
    toast(`解析失败: ${e.message}`,'error');
  }
}

// 处理版本配置文件
async function handleVersionsFile(f) {
  try {
    const content = await f.text();
    const versions = JSON.parse(content);

    if (!versions.versions || !Array.isArray(versions.versions)) {
      toast('Versions 配置格式错误','error');
      return;
    }

    // 存储版本信息
    for (const v of versions.versions) {
      if (v.name && v.content) {
        if (!skillVersions[v.name]) {
          skillVersions[v.name] = [];
        }
        skillVersions[v.name].push({
          version: v.version || 'v1',
          content: v.content,
          description: v.description || ''
        });
      }
    }

    toast(`已加载 ${versions.versions.length} 个版本`,'success');
  } catch (e) {
    toast(`解析失败: ${e.message}`,'error');
  }
}

function renderBenchmarkList() {
  const container = document.getElementById('benchmark-list');
  if (!container) return;

  container.innerHTML = benchmarks.map((b, i) => `
    <div class="file-item" style="background: var(--surface3);">
      <span>📊</span>
      <span class="file-name">${b.name} (v${b.version})</span>
      <span class="file-size">${b.test_cases?.length || 0} 用例</span>
      <button class="file-remove" onclick="removeBenchmark(${i})">✕</button>
    </div>
  `).join('');

  // Update benchmark source select
  const select = document.getElementById('benchmark-source');
  if (select) {
    select.innerHTML = '<option value="generated">自动生成</option>' +
      benchmarks.map(b => `<option value="${b.name}">${b.name} (${b.test_cases?.length || 0})</option>`).join('');
  }

  // Show benchmark section if there are benchmarks
  const section = document.getElementById('benchmark-section');
  if (section) {
    section.style.display = benchmarks.length > 0 ? 'block' : 'none';
  }
}

function removeBenchmark(i) {
  benchmarks.splice(i, 1);
  renderBenchmarkList();
}

// 检测文件名中的版本号
function detectVersion(filename) {
  const match = filename.match(/_v(\d+)[^.]*\.md$|_v(\d+)[^.]*\.skill$/i);
  if (match) {
    return 'v' + (match[1] || match[2]);
  }
  return null;
}

// 处理单个 MD 文件
function handleMdFile(f) {
  const r = new FileReader();
  r.onload = e => {
    // 检查是否已存在同名文件
    if (uploadedFiles.some(x => x.name === f.name)) {
      uploadedFiles = uploadedFiles.filter(x => x.name !== f.name);
    }

    // 检测版本号
    const version = detectVersion(f.name);
    const baseName = f.name.replace(/\.md$|\.skill$/, '').replace(/_v\d+$/, '');

    // 提取技能名称（去掉版本号）
    const skillName = baseName.replace(/_[\w]+$/, '');

    uploadedFiles.push({
      name: f.name,
      content: e.target.result,
      size: f.size,
      type: 'single',
      version: version,
      skillName: skillName  // 用于版本对比的基础名称
    });

    // 如果检测到版本号，添加到版本追踪
    if (version) {
      if (!skillVersions[skillName]) {
        skillVersions[skillName] = [];
      }
      // 避免重复版本
      if (!skillVersions[skillName].find(v => v.version === version)) {
        skillVersions[skillName].push({
          version: version,
          content: e.target.result,
          file: f.name
        });
      }
    }

    renderFileList();
    updateRunInfo();
  };
  r.readAsText(f);
}

// 处理 ZIP 文件
async function handleZipFile(f) {
  if (!window.JSZip) {
    toast('JSZip 库加载失败，请刷新页面或检查网络','error');
    return;
  }

  try {
    toast(`正在解压: ${f.name}`,'info');
    const arrayBuffer = await f.arrayBuffer();
    const zip = await JSZip.loadAsync(arrayBuffer);

    // 解析 ZIP 结构
    const skillPackages = [];
    let fileCount = 0;

    // 按目录分组文件
    const rootFiles = [];
    const subDirs = {};

    zip.forEach((relativePath, zipEntry) => {
      if (zipEntry.dir) return; // 跳过目录

      const name = zipEntry.name;
      const parts = name.split('/').filter(p => p);

      // 跳过隐藏文件和 __MACOSX 目录
      if (name.includes('__MACOSX') || name.includes('/.')) return;

      if (parts.length === 1) {
        // 根目录文件
        rootFiles.push({ path: name, entry: zipEntry });
      } else if (parts.length >= 2) {
        // 子目录文件
        const dir = parts[0];
        if (!subDirs[dir]) subDirs[dir] = [];
        subDirs[dir].push({ path: name, entry: zipEntry });
      }
    });

    // 检查是否是单文件 skill 包（根目录有 md 文件）
    const mdInRoot = rootFiles.filter(f => f.path.endsWith('.md') || f.path.endsWith('.skill'));

    if (mdInRoot.length > 0) {
      // 根目录有 md 文件，作为单个 skill 包处理
      const pkg = { name: f.name.replace('.zip', ''), files: [], scripts: {} };

      for (const rf of rootFiles) {
        const content = await rf.entry.async('string');
        pkg.files.push({ name: rf.path.split('/').pop(), content });
      }

      // 检查 scripts 目录
      if (subDirs['scripts']) {
        for (const sf of subDirs['scripts']) {
          const content = await sf.entry.async('string');
          pkg.scripts[sf.path.split('/').pop()] = content;
        }
      }

      skillPackages.push(pkg);
    } else {
      // 没有根目录 md 文件，检查子目录（每个子目录一个 skill 包）
      for (const [dir, files] of Object.entries(subDirs)) {
        const mdFiles = files.filter(f => f.path.endsWith('.md') || f.path.endsWith('.skill'));
        if (mdFiles.length > 0) {
          const pkg = { name: dir, files: [], scripts: {} };

          for (const mf of mdFiles) {
            const content = await mf.entry.async('string');
            pkg.files.push({ name: mf.path.split('/').pop(), content });
          }

          // 检查 scripts 子目录
          if (subDirs[`${dir}/scripts`]) {
            for (const sf of subDirs[`${dir}/scripts`]) {
              const scriptName = sf.path.split('/').pop();
              const content = await sf.entry.async('string');
              pkg.scripts[scriptName] = content;
            }
          }

          skillPackages.push(pkg);
        }
      }

      // 如果没有找到任何 skill 包
      if (skillPackages.length === 0) {
        toast(`ZIP 中未找到 Skill 文件: ${f.name}`,'error');
        return;
      }
    }

    // 添加到上传文件列表
    for (const pkg of skillPackages) {
      const pkgKey = pkg.name + '_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);

      // 合并所有 md 文件内容
      const combinedContent = pkg.files.map(f => f.content).join('\n\n---\n\n');

      uploadedFiles.push({
        name: pkg.name,
        content: combinedContent,
        size: combinedContent.length,
        type: 'package',
        packageKey: pkgKey,
        files: pkg.files,
        scripts: pkg.scripts
      });
    }

    renderFileList();
    updateRunInfo();
    toast(`已解压 ${skillPackages.length} 个 Skill 包，共 ${skillPackages.reduce((s, p) => s + p.files.length, 0)} 个 md 文件`,'success');

  } catch (e) {
    console.error('ZIP 解压失败:', e);
    toast(`解压失败: ${e.message}`,'error');
  }
}

function renderFileList() {
  document.getElementById('file-list').innerHTML = uploadedFiles.map((f, i) => {
    const icon = f.type === 'package' ? '📦' : '📄';
    const typeLabel = f.type === 'package' ? ' [包]' : '';
    return `
      <div class="file-item">
        <span>${icon}</span><span class="file-name">${f.name}${typeLabel}</span>
        <span class="file-size">${(f.size/1024).toFixed(1)} KB</span>
        <button class="file-remove" onclick="removeFile(${i})">✕</button>
      </div>`;
  }).join('');
}

function removeFile(i) { uploadedFiles.splice(i, 1); renderFileList(); updateRunInfo(); }

function updateRunInfo() {
  const btn = document.getElementById('btn-run'), info = document.getElementById('run-info');
  const ok = uploadedFiles.length > 0 && getApiKey().length > 0 && getModel().length > 0;
  btn.disabled = !ok;

  // 统计包数量和文件数量
  const pkgCount = uploadedFiles.filter(f => f.type === 'package').length;
  const fileCount = uploadedFiles.length;

  if (!getApiKey()) {
    info.textContent = '请填写 API Key';
  } else if (!getModel()) {
    info.textContent = '请填写模型名称';
  } else if (!uploadedFiles.length) {
    info.textContent = '请上传至少一个 SKILL.md 或 ZIP 包';
  } else {
    const suffix = pkgCount > 0 ? ` (${pkgCount} 个包)` : '';
    info.textContent = `${fileCount} 个 Skill${suffix} · ${getNEvals()} 个用例 · ${curProvider} · ${getModel()}`;
  }
}

['api-key', 'model-input', 'n-evals'].forEach(id => document.getElementById(id).addEventListener('input', updateRunInfo));
document.getElementById('api-url').addEventListener('input', updateRunInfo);