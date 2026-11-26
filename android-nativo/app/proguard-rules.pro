# Reglas R8 para kotlinx.serialization, Room y Glance.
-keepattributes *Annotation*, InnerClasses, EnclosingMethod, Signature
-keepclassmembers class * {
    @kotlinx.serialization.SerialName <fields>;
}
-keep,includedescriptorclasses class com.jowy05.jowyfit.datos.modelo.**$$serializer { *; }
-keepclassmembers class com.jowy05.jowyfit.datos.modelo.** {
    *** Companion;
}
-keepclasseswithmembers class com.jowy05.jowyfit.datos.modelo.** {
    kotlinx.serialization.KSerializer serializer(...);
}
-keep class com.jowy05.jowyfit.datos.catalogo.** { *; }
-keep class com.jowy05.jowyfit.widget.** { *; }
