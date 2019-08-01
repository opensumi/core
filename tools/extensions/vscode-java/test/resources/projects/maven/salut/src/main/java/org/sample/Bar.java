package org.sample;

/**
 * This is Bar
 */
public class Bar {

	public static void main(String[] args) {
      System.out.print( "Hello world! from "+Bar.class);
	}
	
	public static interface MyInterface {
		
		void foo();
	}
	
	public static class MyClass {
		
		void bar() {}
	}
}
