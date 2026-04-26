console.log('1');
try {
  const esbuild = await import('esbuild');
  console.log('2', esbuild.version);
} catch (e) {
  console.error(e);
}
