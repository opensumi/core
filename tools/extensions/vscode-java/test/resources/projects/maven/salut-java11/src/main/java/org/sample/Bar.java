package org.sample;

/**
 * This is Bar
 */
public class Bar {

	public static void main(String[] args) {
		var foo = "Hello world! from "+Bar.class; 
		System.out.print( foo );
	}
	
	public static interface MyInterface {
		
		void foo();
	}
	
	public static class MyClass {
		
		void bar() {}
	}
}
