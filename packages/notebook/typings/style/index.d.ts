declare module '*.less';
declare module '*.css';
declare module '*.module.less' {
  const classes: { [className: string]: string };
  export default classes;
}
