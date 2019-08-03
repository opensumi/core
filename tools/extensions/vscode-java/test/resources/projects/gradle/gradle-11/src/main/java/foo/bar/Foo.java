package foo.bar;

/**
 * It's a Foo class
 */
public class Foo {

	/**
	 * It's a Bar interface
	 */
    interface Bar {
		void something(Foo i, Bar j);
    }

    public static void main(String[] args) {
        Bar bar = (var i, var j) -> System.out.println(i.bar() + j.toString());
        System.out.print(bar);
    }

    public String bar() {
    	return toString();
    }
}
