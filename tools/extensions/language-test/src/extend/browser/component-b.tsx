import * as React from 'react';

const defaultTitle = '右侧定制组件';
export default class ComponentB extends React.Component<any, any> {
  state = {
    title: defaultTitle,
  };
  componentDidMount() {
    // const {APIMap} = this.props;

    // if (APIMap) {
    //   APIMap.set({
    //     changeTitle: this.changeTitleHandler,
    //   });
    // }

  }
  changeTitleHandler = (val) => {
    this.setState({
      title: defaultTitle + ' ' + val,
    });
  }
  clickHandler = () => {
    const {kaitianExtendService} = this.props;
    kaitianExtendService.bizHello().then((msg) => {
      console.log('component b host msg', msg);
    });

    // if (togglePanel) {
    //   togglePanel();
    // }
  }
  render() {
    return <div onClick={this.clickHandler} style={{color: 'orange'}}>{this.state.title}</div>;
  }
}
