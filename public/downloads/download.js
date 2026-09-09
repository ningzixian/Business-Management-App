fetch('/downloads/android.json', { cache: 'no-store' }).then(response => {
  if (!response.ok) throw new Error('暂时无法获取安装包，请稍后重试。');
  return response.json();
}).then(release => {
  if (!/^\/downloads\/[A-Za-z0-9._-]+\.apk$/.test(release.path)) throw new Error('安装包地址不可用。');
  document.querySelector('#version').textContent = `安卓内测版 ${release.versionName} · ${(release.size / 1048576).toFixed(1)} MB`;
  const link = document.querySelector('#download');
  link.href = release.path;
  link.download = release.path.split('/').pop();
  link.hidden = false;
  document.querySelector('#hash').textContent = `SHA-256：${release.sha256}`;
  document.querySelector('#notes').textContent = release.notes;
}).catch(error => { document.querySelector('#version').textContent = '下载暂不可用'; document.querySelector('#error').textContent = error.message; });
