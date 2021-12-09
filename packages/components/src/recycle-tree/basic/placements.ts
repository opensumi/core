const autoAdjustOverflow = {
  adjustX: 1,
  adjustY: 1,
};

const targetOffset = [0, 0];

export const placements = {
  bottomLeft: {
    points: ['tl', 'bl'],
    overflow: autoAdjustOverflow,
    offset: [0, 4],
    targetOffset,
  },
};
