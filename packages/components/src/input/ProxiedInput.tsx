import * as React from 'react';

export interface IProxiedInputProps {
  innerRef?: React.Ref<HTMLInputElement>;
  className?: string;
  id?: string;
  style?: React.CSSProperties;
}

interface IPersistentInputPropsInternal extends IProxiedInputProps {
  inputElement: HTMLInputElement;
}

class ProxiedInput extends React.Component<IPersistentInputPropsInternal> {
  private placeholderInputRef: React.RefObject<HTMLInputElement> = React.createRef<HTMLInputElement>();

  public render() {
    return <input type='text' className={this.props.className} id={this.props.id} style={this.props.style} ref={this.placeholderInputRef} />;
  }

  public componentDidMount() {
    const { innerRef, inputElement } = this.props;
    const parent = this.placeholderInputRef.current!.parentElement;
    parent!.replaceChild(inputElement, this.placeholderInputRef.current!);
    this.applyAttributes();
    inputElement.focus();
    if (typeof innerRef === 'function') {
      innerRef(inputElement);
    } else if (innerRef !== null && typeof innerRef === 'object' && innerRef.current === null) {
      (innerRef as any).current = inputElement;
    }
  }

  public componentWillUnmount() {
    const { innerRef, inputElement } = this.props;
    const parent = inputElement.parentElement;
    parent!.replaceChild(this.placeholderInputRef.current!, inputElement);

    if (innerRef !== null && typeof innerRef === 'object' && innerRef.current) {
      (innerRef as any).current = null;
    }
  }

  public shouldComponentUpdate(nextProps) {
    this.applyAttributes(nextProps);
    return false;
  }

  private applyAttributes(props: IPersistentInputPropsInternal = this.props) {
    const { className, id, inputElement, style } = props;
    if (typeof className === 'string') {
      inputElement.className = className;
    }
    if (typeof id === 'string') {
      inputElement.id = id;
    }
    if (style !== null && typeof style === 'object') {
      for (const prop in style) {
        if (typeof style[prop] === 'string' && inputElement[prop]) {
          inputElement[prop] = style[prop];
        }
      }
    }
  }
}

const Input = React.forwardRef((props: IPersistentInputPropsInternal, ref: React.Ref<HTMLInputElement>) => (
  <ProxiedInput {...props} innerRef={ref} />
));

export function bindInputElement(el: HTMLInputElement) {
  return (props: IProxiedInputProps) => <Input {...props} inputElement={el} />;
}
