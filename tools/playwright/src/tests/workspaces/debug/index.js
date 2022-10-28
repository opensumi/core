const str = 'hello';
const str2 = 'opensumi';
const buffStr = Buffer.from(str + str2);

const fn = () => {
  let a = 0;
  setTimeout(() => {
    a += 1;
    console.log(a);
  }, 10);
  console.log(a);
};

fn();

console.log(str);
console.log(str2);
console.log(buffStr);
