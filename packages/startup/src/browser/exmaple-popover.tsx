import React from 'react';

export const ExamplePopover = () => {
  const imgUrl = 'https://gw-office.alipayobjects.com/bmw-prod/f81b277b-5227-483d-9c1c-43f105bcf048.png';

  return (
    <div
      style={{
        width: '200px',
        height: '200px',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        navigator.clipboard.writeText(imgUrl).then(
          function () {
            /* clipboard successfully set */
            alert('图片地址已复制');
          },
          function () {
            /* clipboard write failed */
          },
        );
      }}
    >
      <img
        style={{
          width: '150px',
          height: '150px',
          display: 'block',
        }}
        src={imgUrl}
      ></img>
    </div>
  );
};
