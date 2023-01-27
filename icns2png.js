import child_process from 'child_process';
import path from 'path';

export function icns2png(appName, icnsPath, outputDir) {
  const outputPath = path.join(outputDir, appName + '.png');
  console.log(`Converting icon to PNG (${appName})`);

  // https://stackoverflow.com/a/62892482/15487978
  // https://stackoverflow.com/a/10232330/15487978
  const sips = child_process.spawn('sips',
    ['-s', 'format', 'png', icnsPath, '--out', outputPath]
  );

  sips.stdout.on('data', function (data) {
    //console.log('stdout: ' + data.toString());
  });

  sips.stderr.on('data', function (data) {
    console.error('stderr: ' + data.toString());
  });

  sips.on('exit', function (code) {
    if (!code === 0) {
      console.error('child process exited with code ' + code.toString());
    }
  });
}
