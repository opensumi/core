package org.sample;
import org.apache.commons.lang3.text.WordUtils;
public class TestJavadoc {

	private String foo() {
		Inner inner = new Inner();
		return inner.test;
	}

	public class Inner {
		/** Test */
		public String test;
	}
	
	/**
	 * Uses {@link WordUtils} 
	 */
	public void commonsLang() {
		
	}
}