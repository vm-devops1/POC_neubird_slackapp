export function getClassInstances(classtype: string): Array<any>;
export function getClassInstances(classtype: string, moduleNames?: string[]): Array<any> {
  let list = [];

  if (moduleNames) {
    for (const moduleName of moduleNames) {
      let instances = require('require-all')({
        dirname: __dirname + `/${moduleName}/` + classtype,
        //filter: /(.+service)\.ts$/,
        excludeDirs: /^\.(git|svn)$/,
        recursive: true,
      });

      list = list.concat([
        ...Object.keys(instances)
          .filter(key => key.includes('.' + classtype))
          .map(key => {
            return instances[key][Object.keys(instances[key])[0]];
          }),
      ]);
    }
  } else {
    let instances = require('require-all')({
      dirname: __dirname + '/' + classtype,
      //filter: /(.+service)\.ts$/,
      excludeDirs: /^\.(git|svn)$/,
      recursive: true,
    });

    list = list.concat([
      ...Object.keys(instances)
        .filter(key => key.includes('.' + classtype))
        .map(key => {
          return instances[key][Object.keys(instances[key])[0]];
        }),
    ]);
  }
  return list || [];
}
