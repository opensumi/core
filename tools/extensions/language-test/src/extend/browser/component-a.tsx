import * as React from 'react'

const defaultTitle = '定制组件'

export default class ComponentA extends React.Component<any, any> {
  state = {
    title: defaultTitle,
  };
  componentDidMount() {
    console.log('this.props', this.props);
    const {kaitianExtendSet} = this.props;

    if (kaitianExtendSet) {
      kaitianExtendSet.set({
        changeTitle: this.changeTitleHandler,
      });
    }

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

    if(this.props.kaitianExtendService){
      const kaitianExtendService = this.props.kaitianExtendService
      kaitianExtendService.bizHello().then((msg)=>{
        console.log('component a host msg', msg)
      })
    }
  }
  render() {
    return <div onClick={this.clickHandler} style={{color: 'yellow'}}>{this.state.title}</div>;
  }
}