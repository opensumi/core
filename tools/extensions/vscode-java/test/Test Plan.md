# Test platform

## Windows 10/maxOS/Linux

# Scenarios

## Basic
 1. Open .\resources\eclipse\simple-app. After the language server is initialized, check the status bar icon is :thumbsup:, and the problems view has two errors.
 2. Select Foo.java file, invoke `class` code snippet to generate code as below and the problem view error number is reduced to 1.

	```java
	package app;

	/**
	* Foo
	*/
	public class Foo {


	}
	```
3. Click the remain error in the diagnostic window, the code action icon should pop up both on the problems view and the side bar of the editor. Select the code action of `Create method 'call()' in type 'Foo'` to fix the error.
4. Save all the files, and invoke VSCode command "Java: Force Java compilation". There should be no errors.
5. Typing the following file of code into the App.main method, the completion should work for File and there should be two errors in the problem view.
	```java
	File f = new File("demo.txt");
	```
6. Invoke the context menu command `Source Action...` ==> `Organize Imports`, there should be only one warning remains in the problem view.

## Maven
 1. Open .\resources\maven\salut. After the language server is initialized, check the status bar icon is :thumbsup:, and the problems views has several warnings but without errors.
 2. Editing experience is correctly working including diagnostics, code completion and code actions.

## Maven - Multimodule
1. Open .\resources\maven\multimodule. After the language server is initialized, check the status bar icon is :thumbsup:, and there should be no errors/warning in the problems view.
2. Open Foo.java file, make sure the editing experience is correctly working including diagnostics, code completion and code action on both modules.
	- module1\Foo.java
	- module2\Foo.java

## Gradle
 1. Open .\resources\gradle\simple-gradle. After the language server is initialized, check the status bar icon is :thumbsup:, and there should be no errors/problems in the problems view.
 2. Open Foo.java file, make sure the editing experience is correctly working including diagnostics, code completion and code action

## Maven - Java 11
1. Install JDK  11, and change the VSCode java.home to the JDK 11 path.
2. Open .\resources\maven\salut-java11. After the language server is initialized, check the status bar icon is :thumbsup:, and there should be no errors/problems in the problems view.
3. Open Bar.java, make sure the editing experience is correctly working including diagnostics, code completion and code action

## Gradle - Java 11
1. Install JDK  11.
2. Open .\resources\gradle\gradle-11. After the language server is initialized, check the status bar icon is :thumbsup:, and there should be no errors/problems in the problems view.
2. Open Foo.java file, make sure the editing experience is correctly working including diagnostics, code completion and code action.

## Single file
1. Open/Create an empty folder
2. Add a new Java file, name it Test.java. Check the language server is initialized, and the status bar icon is :thumbsup: after that.
3. Type code snippet `class` to generate the class body, type `main` to generate the main methods.
4. In the Test.java file,  make sure the editing experience is correctly working including diagnostics, code completion and code action.
