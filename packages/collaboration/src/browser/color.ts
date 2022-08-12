const color = ['red', 'orange', 'yellow', 'green', 'blue', 'indigo', 'violent'];

// get color by clientID
export const getColorByClientID = (id: number): string => color[id % color.length];
