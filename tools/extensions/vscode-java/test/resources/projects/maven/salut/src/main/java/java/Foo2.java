package java;

import java.io.IOException;

import org.apache.commons.lang3.AnnotationUtils;

public class Foo2 {
	
	
	/**
	 * {@value #mySimpleString} is a simple String
	 */
	public static final String mySimpleString =
	 	"SimpleStringData";
	
	/**
	 * {@link #newMethodBeingLinkedToo}
	 */
	public void javadocLinkToMethodInClass() {
        
	}
	
	private void newMethodBeingLinkedToo() {
		
	}
	
	/**
	 * {@link Foo#linkedFromFoo2()}
	 */
	private void javadocLinkToMethodInOtherClass() {
		
	}

	/**
	 * This Javadoc contains a link to
	 * {@link #newMethodBeingLinkedToo}
	 * @see <a href="https://docs.oracle.com/javase/7/docs/api/">Online docs for java</a>
	 * @param someString the string to enter
	 * @since 0.0.1
	 * @version 0.0.1
	 * @author jpinkney
	 * @return String
	 * @throws IOException
	 */
    private String javadocLink(String someString) throws IOException {
		return null;
	}

    /**
     * This link doesnt work {@link LinkToSomethingNotFound}
     */
    private void linkDoesNotExist() {

    }
	
}
