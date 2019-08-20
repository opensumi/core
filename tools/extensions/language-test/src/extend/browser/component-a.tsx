import * as React from 'react'

const defaultTitle = '定制组件'

export default class ComponentA extends React.Component<any, any> {
  state = {
    title: defaultTitle,
  };
  componentDidMount() {
    console.log('this.props', this.props);
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
    // const {bizRPCProtocol, togglePanel} = this.props;
    // bizRPCProtocol.bizHello().then((msg) => {
    //   console.log('biz message result', msg);
    // });

    // if (togglePanel) {
    //   togglePanel();
    // }
  }
  render() {
    return <div onClick={this.clickHandler} style={{color: 'yellow'}}>{this.state.title}</div>;
  }
}